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
 * Example demonstrating every supported lifecycle hook.
 *
 * This example registers one hook for each supported lifecycle event and logs
 * what was received. The hooks themselves are trivial — the goal is to show how
 * to wire every hook type and what data each one receives.
 *
 * To run:
 *   pnpm ts-node examples/deep_dives/host_tool_hooks.ts
 */

import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";
import {
  OnSessionStartHook,
  OnSessionEndHook,
  PreTurnHook,
  PostTurnHook,
  PreToolCallDecideHook,
  PostToolCallHook,
  OnToolErrorHook,
  OnCompactionHook,
  OnInteractionHook,
  HookContext,
  HookResult,
  ToolCall,
  ToolResult,
  BuiltinTools,
  AskQuestionInteractionSpec,
  QuestionHookResult
} from "../../src/index.js";

// =============================================================================
// Hook implementations — each one simply logs what it received.
// =============================================================================

class LogSessionStartHook implements OnSessionStartHook {
  async run(): Promise<void> {
    console.log("[Hook] Session started.");
  }
}

class LogSessionEndHook implements OnSessionEndHook {
  async run(): Promise<void> {
    console.log("[Hook] Session ended.");
  }
}

class LogPreTurnHook implements PreTurnHook {
  async run(_context: HookContext, data: any): Promise<HookResult> {
    console.log(`[Hook] Pre-turn — user prompt: ${JSON.stringify(data)}`);
    return { allow: true };
  }
}

class LogPostTurnHook implements PostTurnHook {
  async run(_context: HookContext, data: string): Promise<void> {
    console.log(`[Hook] Post-turn — response: ${JSON.stringify(data)}`);
  }
}

class LogPreToolCallDecideHook implements PreToolCallDecideHook {
  async run(_context: HookContext, data: ToolCall): Promise<HookResult> {
    console.log(`[Hook] Pre-tool-call (decide) — tool: ${JSON.stringify(data)}`);
    return { allow: true };
  }
}

class LogPostToolCallHook implements PostToolCallHook {
  async run(_context: HookContext, data: ToolResult): Promise<void> {
    console.log(`[Hook] Post-tool-call — result: ${JSON.stringify(data)}`);
  }
}

class LogToolErrorHook implements OnToolErrorHook {
  async run(_context: HookContext, data: Error): Promise<any> {
    console.log(`[Hook] Tool error — ${data.message}`);
    return null; // No recovery; let the error propagate.
  }
}

class LogPreSubagentCallHook implements PreToolCallDecideHook {
  async run(_context: HookContext, data: ToolCall): Promise<HookResult> {
    if (data.name === BuiltinTools.START_SUBAGENT) {
      console.log(`[Hook] Pre-subagent-call — tool_call: ${JSON.stringify(data)}`);
    }
    return { allow: true };
  }
}

class LogPostSubagentCallHook implements PostToolCallHook {
  async run(_context: HookContext, data: ToolResult): Promise<void> {
    if (data.name === BuiltinTools.START_SUBAGENT) {
      console.log(`[Hook] Post-subagent-call — result: ${JSON.stringify(data)}`);
    }
  }
}

class LogCompactionHook implements OnCompactionHook {
  async run(_context: HookContext): Promise<void> {
    console.log("[Hook] Compaction occurred.");
  }
}

class LogInteractionHook implements OnInteractionHook {
  async run(_context: HookContext, data: AskQuestionInteractionSpec): Promise<QuestionHookResult> {
    console.log(`[Hook] Interaction — spec: ${JSON.stringify(data.questions)}`);
    const responses = (data.questions || []).map((q) => {
      if (q.options && q.options.length > 0) {
        return { selected_option_ids: [q.options[0].id] };
      }
      return { freeform_response: "auto-response" };
    });
    return { responses };
  }
}

// =============================================================================
// Custom tools to trigger tool hooks
// =============================================================================

function greet(args: { name: string }): string {
  return `Hello, ${args.name}!`;
}

function broken_tool(): string {
  throw new Error("This tool is intentionally broken!");
}

// =============================================================================
// Helper to run a single prompt and print the response
// =============================================================================

async function runPrompt(agent: Agent, prompt: string): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log(`--- Sending: '${prompt}' ---`);
  console.log("=".repeat(60));

  await agent.conversation.send(prompt);
  const steps = agent.conversation.receiveSteps();
  for await (const step of steps) {
    if (step.is_complete_response) {
      const cascade_id = (step as any).cascade_id || "";
      const trajectory_id = (step as any).trajectory_id || "";
      const is_parent = !cascade_id || trajectory_id === cascade_id;
      const label = is_parent ? "Final response" : "Subagent response";
      console.log(`\n--- ${label} ---\n${step.content}\n`);
    }
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const config = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    hooks: [
      new LogSessionStartHook(),
      new LogSessionEndHook(),
      new LogPreTurnHook(),
      new LogPostTurnHook(),
      new LogPreToolCallDecideHook(),
      new LogPreSubagentCallHook(),
      new LogPostToolCallHook(),
      new LogPostSubagentCallHook(),
      new LogToolErrorHook(),
      new LogCompactionHook(),
      new LogInteractionHook()
    ],
    tools: [greet, broken_tool],
    capabilities: {
      enable_subagents: true
    }
  });

  console.log("Starting agent...");
  await Agent.run(config, async (agent) => {
    // 1. Tool hooks: greet triggers pre/post tool call.
    await runPrompt(agent, "Please greet Alice using the greet tool.");

    // 2. Tool error hook: broken_tool always raises.
    try {
      await runPrompt(agent, "Please call the broken_tool tool.");
    } catch (e: any) {
      console.log(`Expected tool execution exception caught in application: ${e.message}`);
    }

    // 3. Interaction hook: ask_question triggers OnInteraction.
    await runPrompt(agent, "Ask me a multiple-choice trivia question.");

    // 4. Subagent hooks: invoke_subagent triggers pre/post subagent.
    await runPrompt(agent, "Invoke a subagent to write a short poem about nature.");

    console.log("\n--- All prompts complete ---");
  });
}

main().catch(console.error);
