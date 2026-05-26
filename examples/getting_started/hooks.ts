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

/**
 * Example demonstrating all supported lifecycle hooks in Google Antigravity SDK.
 *
 * This example shows how to use class-based hooks to register for various
 * lifecycle events, including session, turn, tool, interaction, and compaction.
 *
 * To run:
 *   pnpm ts-node examples/getting_started/hooks.ts
 */

import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";
import {
  HookContext,
  PreTurnHook,
  PostTurnHook,
  PreToolCallDecideHook,
  PostToolCallHook,
  OnToolErrorHook,
  HookResult,
  ToolCall,
  ToolResult
} from "../../src/index.js";

// -----------------------------------------------------------------------------
// Lifecycle Hook Implementations
// -----------------------------------------------------------------------------

class MyPreTurnHook implements PreTurnHook {
  async run(_context: HookContext, data: any): Promise<HookResult> {
    console.log(`\n  [Hook] Pre-turn: Intercepted prompt -> ${JSON.stringify(data)}`);
    return { allow: true };
  }
}

class MyPostTurnHook implements PostTurnHook {
  async run(_context: HookContext, data: string): Promise<void> {
    console.log(`\n  [Hook] Post-turn: Final response -> ${JSON.stringify(data)}`);
  }
}

class MyPreToolCallDecideHook implements PreToolCallDecideHook {
  async run(_context: HookContext, data: ToolCall): Promise<HookResult> {
    console.log(`\n  [Hook] Pre-tool-call: Approving tool -> ${data.name}`);
    return { allow: true };
  }
}

class MyPostToolCallHook implements PostToolCallHook {
  async run(_context: HookContext, data: ToolResult): Promise<void> {
    console.log(`\n  [Hook] Post-tool-call: Result -> ${JSON.stringify(data)}`);
  }
}

class MyOnToolErrorHook implements OnToolErrorHook {
  async run(_context: HookContext, data: Error): Promise<any> {
    console.log(`\n  [Hook] Tool error: ${data.message}`);
    return null; // Let the error propagate
  }
}

// -----------------------------------------------------------------------------
// Helper Tools
// -----------------------------------------------------------------------------

function greet(args: { name: string }): string {
  return `Hello, ${args.name}!`;
}

function broken_tool(): string {
  throw new Error("This tool is intentionally broken!");
}

// -----------------------------------------------------------------------------
// Main Execution
// -----------------------------------------------------------------------------

async function main() {
  const config = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    hooks: [
      new MyPreTurnHook(),
      new MyPostTurnHook(),
      new MyPreToolCallDecideHook(),
      new MyPostToolCallHook(),
      new MyOnToolErrorHook()
    ],
    tools: [greet, broken_tool]
  });

  console.log("Starting session...");
  await Agent.run(config, async (my_agent) => {
    console.log("  --- Starting Interaction ---");

    // 1. Trigger Turn Hooks
    console.log("\n  --- Prompt 1: Simple Chat ---");
    const response1 = await my_agent.chat("Say 'Hello World!'");
    const text1 = await response1.text();
    console.log(`  Agent Response: ${text1}`);

    // 2. Trigger Tool Hooks
    console.log("\n  --- Prompt 2: Tool Usage ---");
    const response2 = await my_agent.chat("Please greet Alice using the greet tool.");
    const text2 = await response2.text();
    console.log(`  Agent Response: ${text2}`);

    // 3. Trigger Tool Error Hook
    console.log("\n  --- Prompt 3: Tool Error ---");
    try {
      const response3 = await my_agent.chat("Please call the broken_tool.");
      const text3 = await response3.text();
      console.log(`  Agent Response: ${text3}`);
    } catch (e: any) {
      console.log(`  Caught expected tool execution error in app: ${e.message}`);
    }

    console.log("\n  --- Finished Interaction ---");
  });
}

main().catch(console.error);
