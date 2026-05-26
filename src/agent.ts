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

import { AgentConfig } from "./connections/connection.js";
import { Conversation } from "./conversation/conversation.js";
import { Content, ChatResponse } from "./types.js";
import { HookRunner } from "./hooks/hookRunner.js";

export class Agent {
  private _config: AgentConfig;
  private _strategy: any = null;
  private _conversation: Conversation | null = null;
  private _toolRunner: any = null;
  private _hookRunner: HookRunner | null = null;
  private _isStarted = false;

  constructor(config: AgentConfig) {
    this._config = config;
  }

  get config(): AgentConfig {
    return this._config;
  }

  registerHook(hook: any): void {
    if (this._hookRunner) {
      this._hookRunner.registerHook(hook);
    }
  }

  static async run<T>(config: AgentConfig, fn: (agent: Agent) => Promise<T>): Promise<T> {
    const agent = new Agent(config);
    await agent.start();
    try {
      return await fn(agent);
    } finally {
      await agent.stop();
    }
  }

  async start(): Promise<Agent> {
    if (this._isStarted) return this;

    // Instantiate and populate HookRunner
    this._hookRunner = new HookRunner();
    if (this._config.hooks) {
      for (const hook of this._config.hooks) {
        this._hookRunner.registerHook(hook);
      }
    }

    this._strategy = this._config.createStrategy(this._toolRunner, this._hookRunner);
    await this._strategy.start();

    const conn = this._strategy.connect();
    this._conversation = new Conversation(conn);
    this._isStarted = true;

    return this;
  }

  async stop(): Promise<void> {
    if (!this._isStarted) return;
    if (this._conversation) {
      await this._conversation.disconnect();
      this._conversation = null;
    }
    if (this._strategy) {
      await this._strategy.stop();
      this._strategy = null;
    }
    this._isStarted = false;
  }

  async chat(prompt: Content): Promise<ChatResponse> {
    if (!this._conversation) {
      throw new Error("Agent session not started. Call start() first or use Agent.run()");
    }
    return this._conversation.chat(prompt);
  }

  get isStarted(): boolean {
    return this._isStarted;
  }

  get conversation(): Conversation {
    if (!this._conversation) {
      throw new Error("Agent session not started.");
    }
    return this._conversation;
  }

  get conversationId(): string | null {
    if (!this._conversation) return null;
    return this._conversation.conversationId || null;
  }
}
