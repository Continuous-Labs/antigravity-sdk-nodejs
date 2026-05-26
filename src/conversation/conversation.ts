// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Connection } from "../connections/connection.js";
import {
  Step,
  StepType,
  StepSource,
  StepTarget,
  Content,
  ChatChunk,
  ChatResponse,
  UsageMetadata
} from "../types.js";

const DEFAULT_MAX_HISTORY_SIZE = 10000;

function zeroUsage(): UsageMetadata {
  return {
    prompt_token_count: 0,
    cached_content_token_count: 0,
    candidates_token_count: 0,
    thoughts_token_count: 0,
    total_token_count: 0
  };
}

function addUsage(target: UsageMetadata, source: UsageMetadata) {
  target.prompt_token_count = (target.prompt_token_count || 0) + (source.prompt_token_count || 0);
  target.cached_content_token_count = (target.cached_content_token_count || 0) + (source.cached_content_token_count || 0);
  target.candidates_token_count = (target.candidates_token_count || 0) + (source.candidates_token_count || 0);
  target.thoughts_token_count = (target.thoughts_token_count || 0) + (source.thoughts_token_count || 0);
  target.total_token_count = (target.total_token_count || 0) + (source.total_token_count || 0);
}

export class Conversation {
  private _connection: Connection;
  private _steps: Step[] = [];
  private _turnStartIndices: number[] = [];
  private _compactionIndices: number[] = [];
  private _maxHistorySize: number;
  private _cumulativeUsage = zeroUsage();
  private _turnUsage: UsageMetadata | null = null;

  constructor(conn: Connection, options?: { max_history_size?: number }) {
    this._connection = conn;
    this._maxHistorySize = options?.max_history_size ?? DEFAULT_MAX_HISTORY_SIZE;
  }

  get connection(): Connection {
    return this._connection;
  }

  get conversationId(): string {
    return this._connection.conversationId;
  }

  get history(): Step[] {
    return [...this._steps];
  }

  get lastResponse(): string {
    for (let i = this._steps.length - 1; i >= 0; i--) {
      const step = this._steps[i];
      if (step.is_complete_response) {
        return step.content;
      }
    }
    return "";
  }

  get turnCount(): number {
    return this._turnStartIndices.length;
  }

  get compactionIndices(): number[] {
    return [...this._compactionIndices];
  }

  get totalUsage(): UsageMetadata {
    return { ...this._cumulativeUsage };
  }

  get lastTurnUsage(): UsageMetadata | null {
    return this._turnUsage ? { ...this._turnUsage } : null;
  }

  getLastStructuredOutput(): any | null {
    for (let i = this._steps.length - 1; i >= 0; i--) {
      const step = this._steps[i];
      if (step.type === StepType.FINISH) {
        return step.structured_output;
      }
    }
    return null;
  }

  async send(prompt: Content | null, options?: Record<string, any>): Promise<void> {
    if (!this._connection.isIdle) {
      try {
        const stepIterator = this.receiveSteps();
        while (true) {
          const next = await stepIterator.next();
          if (next.done) break;
        }
      } catch (err) {
        await this._connection.waitForIdle();
      }
    }

    this._turnStartIndices.push(this._steps.length);
    this._turnUsage = null;
    await this._connection.send(prompt, options);
  }

  async *receiveSteps(): AsyncGenerator<Step, void, unknown> {
    const iterator = this._connection.receiveSteps()[Symbol.asyncIterator]();
    while (true) {
      const res = await iterator.next();
      if (res.done) break;
      const step = res.value;

      this._steps.push(step);
      if (step.type === StepType.COMPACTION) {
        this._compactionIndices.push(this._steps.length - 1);
      }
      if (step.usage_metadata) {
        this._accumulateUsage(step.usage_metadata);
      }
      this._enforceMaxHistory();
      yield step;
    }
  }

  async *receiveChunks(): AsyncGenerator<ChatChunk, void, unknown> {
    const seenToolIds = new Set<string>();
    const stepIterator = this.receiveSteps();

    while (true) {
      const res = await stepIterator.next();
      if (res.done) break;
      const step = res.value;

      const isModel = step.source === StepSource.MODEL;
      const isTargetUser = step.target === StepTarget.USER;

      if (isModel && isTargetUser) {
        if (step.thinking_delta) {
          yield {
            type: "thought",
            step_index: step.step_index,
            text: step.thinking_delta
          };
        }
        if (step.content_delta) {
          yield {
            type: "text",
            step_index: step.step_index,
            text: step.content_delta
          };
        }
      }

      if (step.tool_calls) {
        for (const tc of step.tool_calls) {
          if (!tc.id || !seenToolIds.has(tc.id)) {
            if (tc.id) {
              seenToolIds.add(tc.id);
            }
            yield tc;
          }
        }
      }
    }
  }

  async chat(prompt: Content | null = null, options?: Record<string, any>): Promise<ChatResponse> {
    await this.send(prompt, options);
    return new ChatResponse(this.receiveChunks(), this);
  }

  clearHistory(): void {
    this._steps = [];
    this._turnStartIndices = [];
    this._compactionIndices = [];
    this._cumulativeUsage = zeroUsage();
    this._turnUsage = null;
  }

  private _enforceMaxHistory() {
    if (this._maxHistorySize && this._steps.length > this._maxHistorySize) {
      const overflow = this._steps.length - this._maxHistorySize;
      this._steps = this._steps.slice(overflow);
      this._turnStartIndices = this._turnStartIndices
        .map(i => i - overflow)
        .filter(i => i >= 0);
      this._compactionIndices = this._compactionIndices
        .map(i => i - overflow)
        .filter(i => i >= 0);
    }
  }

  private _accumulateUsage(usage: UsageMetadata) {
    addUsage(this._cumulativeUsage, usage);
    if (!this._turnUsage) {
      this._turnUsage = zeroUsage();
    }
    addUsage(this._turnUsage, usage);
  }

  async cancel(): Promise<void> {
    await this._connection.cancel();
  }

  async delete(): Promise<void> {
    await this._connection.delete();
  }

  async signalIdle(): Promise<void> {
    await this._connection.signalIdle();
  }

  async wait_for_idle(): Promise<void> {
    await this._connection.waitForIdle();
  }

  async disconnect(): Promise<void> {
    await this._connection.disconnect();
  }
}
