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

import { describe, it, expect } from "vitest";
import { Agent } from "./agent.js";
import { AgentConfig, Connection, ConnectionStrategy } from "./connections/connection.js";
import { Step, Content, StepType, StepSource, StepTarget, StepStatus } from "./types.js";
import { PreTurnHook, HookContext, HookResult } from "./hooks/hooks.js";

// -----------------------------------------------------------------------------
// Mock Transport Layer for Blazing Fast Context Execution
// -----------------------------------------------------------------------------

class MockConnection extends Connection {
  private _conversationId = "mock-session-12345";

  get conversationId(): string {
    return this._conversationId;
  }

  async send(prompt: Content | null): Promise<void> {}

  async *receiveSteps(): AsyncIterable<Step> {
    yield {
      id: "step-1",
      step_index: 0,
      type: StepType.TEXT_RESPONSE,
      source: StepSource.MODEL,
      target: StepTarget.USER,
      status: StepStatus.DONE,
      content: "Hello from Mock Agent!",
      content_delta: "Hello from Mock Agent!",
      thinking: "",
      thinking_delta: "",
      tool_calls: [],
      error: ""
    };
  }

  async disconnect(): Promise<void> {}
  async cancel(): Promise<void> {}
  async delete(): Promise<void> {}
  async signalIdle(): Promise<void> {}
  async waitForIdle(): Promise<void> {}
  async waitForWakeup(): Promise<boolean> {
    return true;
  }
  async sendToolResults(): Promise<void> {}
  async sendTriggerNotification(): Promise<void> {}
}

class MockStrategy extends ConnectionStrategy {
  private _started = false;

  connect(): Connection {
    return new MockConnection();
  }

  async start(): Promise<void> {
    this._started = true;
  }

  async stop(): Promise<void> {
    this._started = false;
  }

  get isStarted(): boolean {
    return this._started;
  }
}

class MockAgentConfig extends AgentConfig {
  createStrategy(toolRunner: any, hookRunner: any): ConnectionStrategy {
    return new MockStrategy();
  }
}

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe("Agent Lifecycle and Hooks Tests", () => {
  it("should initialize with custom configurations", () => {
    const config = new MockAgentConfig();
    const agent = new Agent(config);
    expect(agent.config).toBe(config);
    expect(agent.isStarted).toBe(false);
  });

  it("should start and stop session lifecycles correctly", async () => {
    const config = new MockAgentConfig();
    const agent = new Agent(config);

    await agent.start();
    expect(agent.isStarted).toBe(true);
    expect(agent.conversationId).toBe("mock-session-12345");

    await agent.stop();
    expect(agent.isStarted).toBe(false);
  });

  it("should execute conversational chat turns", async () => {
    const config = new MockAgentConfig();
    const agent = new Agent(config);

    await agent.start();
    const response = await agent.chat("Hi");
    const text = await response.text();

    expect(text).toBe("Hello from Mock Agent!");
    await agent.stop();
  });

  it("should support functional Agent.run context loops", async () => {
    const config = new MockAgentConfig();

    const output = await Agent.run(config, async (agent) => {
      expect(agent.isStarted).toBe(true);
      const response = await agent.chat("Hi");
      return response.text();
    });

    expect(output).toBe("Hello from Mock Agent!");
  });

  it("should dynamically register and trigger observer hooks", async () => {
    let preTurnFired = false;
    const config = new MockAgentConfig();

    class TestPreTurnHook implements PreTurnHook {
      async run(context: HookContext, data: any): Promise<HookResult> {
        preTurnFired = true;
        return { allow: true };
      }
    }

    config.hooks = [new TestPreTurnHook()];
    const agent = new Agent(config);

    await agent.start();

    // Verify hooks are registered and can be triggered via hookRunner
    const runner = (agent as any)._hookRunner;
    expect(runner).toBeDefined();

    const preTurnHooks = (runner as any)._preTurnHooks;
    expect(preTurnHooks).toHaveLength(1);

    const context = new HookContext();
    const res = await preTurnHooks[0].run(context, "Test prompt");
    expect(res.allow).toBe(true);
    expect(preTurnFired).toBe(true);

    await agent.stop();
  });
});
