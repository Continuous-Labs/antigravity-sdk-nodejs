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
 * Hook middleware: transparent tool interception.
 *
 * Demonstrates how stacked hooks create emergent behavior the agent
 * is unaware of. The agent calls tools normally; hooks enforce rate
 * limits, log an audit trail, and recover from errors — all without
 * the agent's knowledge.
 *
 * Hooks stack (executed in order):
 * - PreToolCallDecideHook: enforces per-tool rate limits.
 * - PostToolCallHook: logs every call + result to an audit trail.
 * - OnToolErrorHook: returns a graceful fallback on failure.
 *
 * To run:
 *   pnpm ts-node examples/deep_dives/agent_middleware.ts
 */

import { performance } from "perf_hooks";
import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";
import {
  PreToolCallDecideHook,
  PostToolCallHook,
  OnToolErrorHook,
  HookContext,
  HookResult,
  ToolCall,
  ToolResult
} from "../../src/index.js";

// ---------------------------------------------------------------------------
// Simulated tools — intentionally simple to highlight hook behavior
// ---------------------------------------------------------------------------

async function lookup_user(args: { email: string }): Promise<string> {
  return `User profile for ${args.email}: name=Alice, role=engineer, team=infra`;
}

async function send_notification(args: { to: string; message: string }): Promise<string> {
  return `Notification sent to ${args.to}: ${args.message}`;
}

async function send_to_unknown(args: { name: string; message: string }): Promise<string> {
  throw new Error(`Could not resolve '${args.name}' to an email address`);
}

// ---------------------------------------------------------------------------
// Hook: Rate Limiting (PreToolCallDecideHook)
// ---------------------------------------------------------------------------

class RateLimitHook implements PreToolCallDecideHook {
  static MAX_CALLS_PER_TOOL = 3;
  static WINDOW_SECONDS = 60.0;

  private _calls = new Map<string, number[]>();

  async run(_context: HookContext, data: ToolCall): Promise<HookResult> {
    const now = performance.now() / 1000;
    const toolName = data.name;

    if (!this._calls.has(toolName)) {
      this._calls.set(toolName, []);
    }
    const history = this._calls.get(toolName)!;

    // Prune calls outside the window
    const activeHistory = history.filter((t) => now - t < RateLimitHook.WINDOW_SECONDS);
    this._calls.set(toolName, activeHistory);

    if (activeHistory.length >= RateLimitHook.MAX_CALLS_PER_TOOL) {
      console.log(
        `  🚫 [RateLimit] Denied ${toolName}` +
        ` (${RateLimitHook.MAX_CALLS_PER_TOOL} calls in ${RateLimitHook.WINDOW_SECONDS}s)`
      );
      return {
        allow: false,
        message:
          `Rate limit exceeded: ${toolName} called` +
          ` ${RateLimitHook.MAX_CALLS_PER_TOOL} times in ${RateLimitHook.WINDOW_SECONDS}s`
      };
    }

    activeHistory.push(now);
    return { allow: true };
  }
}

// ---------------------------------------------------------------------------
// Hook: Audit Log (PostToolCallHook)
// ---------------------------------------------------------------------------

interface AuditEntry {
  tool: string;
  result: string;
  error?: string | null;
}

class AuditLogHook implements PostToolCallHook {
  public log: AuditEntry[] = [];

  async run(_context: HookContext, data: ToolResult): Promise<void> {
    const entry: AuditEntry = {
      tool: data.name,
      result: typeof data.result === "string" ? data.result : JSON.stringify(data.result),
      error: data.error
    };
    this.log.push(entry);
    const status = entry.error ? "❌" : "✅";
    console.log(`  📝 [Audit] ${status} ${entry.tool}: ${entry.result}`);
  }
}

// ---------------------------------------------------------------------------
// Hook: Error Recovery (OnToolErrorHook)
// ---------------------------------------------------------------------------

class FallbackHook implements OnToolErrorHook {
  async run(_context: HookContext, data: Error): Promise<string | null> {
    console.log(`  🔧 [Fallback] Caught Error: ${data.message}`);

    if (data.message.includes("Could not resolve")) {
      return (
        "[Could not find that user. Use the lookup_user tool with " +
        "their email address instead of their display name.]"
      );
    }

    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🔌 Hook Middleware Example\n");

  const rateLimitHook = new RateLimitHook();
  const auditHook = new AuditLogHook();
  const fallbackHook = new FallbackHook();

  const config = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    system_instructions:
      "You have access to user lookup, notification, and diagnostic" +
      " tools. Use them as needed. Keep responses under 2 sentences.",
    tools: [lookup_user, send_notification, send_to_unknown],
    hooks: [rateLimitHook, auditHook, fallbackHook]
  });

  await Agent.run(config, async (agent) => {
    // 1. Normal tool call + audit logging.
    console.log("\n" + "=".repeat(60));
    console.log("📨 Prompt 1: Normal tool use (audit logged)");
    console.log("=".repeat(60));
    const r2 = await agent.chat(
      "Send a notification to bob@company.org saying 'Welcome aboard!'."
    );
    const text2 = await r2.text();
    console.log(`\n  💬 Agent: ${text2.trim()}`);

    // 2. Error recovery: send_to_unknown fails, FallbackHook steers the model toward using lookup_user instead.
    console.log("\n" + "=".repeat(60));
    console.log("📨 Prompt 2: Trigger error recovery");
    console.log("=".repeat(60));
    const r3 = await agent.chat(
      "Send a message to 'Charlie' saying 'Hey, are you free tomorrow?'"
    );
    const text3 = await r3.text();
    console.log(`\n  💬 Agent: ${text3.trim()}`);

    // 3. Rate limiting: exceed the per-tool limit.
    console.log("\n" + "=".repeat(60));
    console.log("📨 Prompt 3: Trigger rate limiting");
    console.log("=".repeat(60));
    const r4 = await agent.chat(
      "Look up user1@test.com, then user2@test.com, then user3@test.com," +
      " then user4@test.com. Use the lookup_user tool for each one."
    );
    const text4 = await r4.text();
    console.log(`\n  💬 Agent: ${text4.trim()}`);

    console.log("\n" + "=".repeat(60));
    console.log(`📋 Audit Log (${auditHook.log.length} entries)`);
    console.log("=".repeat(60));
    auditHook.log.forEach((entry, i) => {
      const status = entry.error ? "❌" : "✅";
      console.log(`  ${i + 1}. ${status} ${entry.tool}: ${entry.result}`);
    });
  });
}

main().catch(console.error);
