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
import { ToolRunner } from "./toolRunner.js";
import { ToolContext } from "./toolContext.js";
import { ToolCall } from "../types.js";

describe("ToolRunner and ToolContext Tests", () => {
  // 1. Simple tool
  function add(args: { a: number; b: number }): number {
    return args.a + args.b;
  }

  // 2. Exploding tool
  function failTool(): void {
    throw new Error("Simulated tool execution failure");
  }

  // 3. Stateful tool using injected ToolContext
  function incrementCounter(args: { step?: number }, ctx: ToolContext): number {
    const current = ctx.getState<number>("count") || 0;
    const next = current + (args.step ?? 1);
    ctx.setState("count", next);
    return next;
  }

  it("should register and run simple function tools", async () => {
    const runner = new ToolRunner([add]);
    const calls: ToolCall[] = [
      { name: "add", args: { a: 5, b: 12 }, id: "1" }
    ];
    const results = await runner.processToolCalls(calls);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("add");
    expect(results[0].id).toBe("1");
    expect(results[0].result).toBe(17);
    expect(results[0].error).toBeUndefined();
  });

  it("should catch errors and format them correctly on tool failures", async () => {
    const runner = new ToolRunner([failTool]);
    const calls: ToolCall[] = [
      { name: "failTool", args: {}, id: "2" }
    ];
    const results = await runner.processToolCalls(calls);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("failTool");
    expect(results[0].error).toContain("Simulated tool execution failure");
    expect(results[0].exception).toBeInstanceOf(Error);
  });

  it("should return clean errors for unregistered tools", async () => {
    const runner = new ToolRunner();
    const calls: ToolCall[] = [
      { name: "missingTool", args: {}, id: "3" }
    ];
    const results = await runner.processToolCalls(calls);

    expect(results).toHaveLength(1);
    expect(results[0].error).toContain("not found");
  });

  it("should maintain state context across stateful tool calls", async () => {
    const runner = new ToolRunner([incrementCounter]);
    const context = new ToolContext();
    runner.setContext(context);

    // Call 1: increment by 5
    const results1 = await runner.processToolCalls([
      { name: "incrementCounter", args: { step: 5 }, id: "4" }
    ]);
    expect(results1[0].result).toBe(5);
    expect(context.getState("count")).toBe(5);

    // Call 2: increment by default (1)
    const results2 = await runner.processToolCalls([
      { name: "incrementCounter", args: {}, id: "5" }
    ]);
    expect(results2[0].result).toBe(6);
    expect(context.getState("count")).toBe(6);
  });
});
