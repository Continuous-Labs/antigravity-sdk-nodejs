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
 * Example demonstrating tool call policies in Google Antigravity SDK.
 *
 * This example shows how to secure an agent using declarative tool call policies.
 * By default, LocalAgentConfig denies dangerous tools and confirms run_command.
 * To lock down further for production or untrusted environments, developers can
 * override this default with explicit safety policies.
 *
 * Policies operate at the runtime decision layer: tools remain visible in the
 * agent's context, but calls that violate policies are denied with an explanation,
 * allowing the agent to understand why access was blocked and adapt its approach.
 *
 * Demonstrates:
 * 1. The recommended "Deny by Default" posture: blocking all tools by default,
 *    and explicitly allowing only what is necessary.
 * 2. Specific Denylist rules (e.g., blocking dangerous shell commands like `rm`).
 * 3. Specific Allowlist rules (e.g., allowing only specific safe commands).
 * 4. Interactive confirmation rules using `policy.askUser()`.
 *
 * To run:
 *   pnpm ts-node examples/getting_started/policies.ts
 */

import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";
import { policy, BuiltinTools, ToolCall } from "../../src/index.js";

function blockRmPredicate(args: Record<string, any>): boolean {
  const command = args.command_line || args.command || "";
  return command.includes("rm");
}

function criticalFilePredicate(args: Record<string, any>): boolean {
  const target = args.TargetFile || args.file_path || args.path || args.AbsolutePath || "";
  return target.endsWith(".key") || target.includes("production");
}

function programmaticApprovalHandler(toolCall: ToolCall): boolean {
  console.log(`\n  [ASK_USER Handler] Intercepted request for tool: ${toolCall.name}`);
  console.log(`  [ASK_USER Handler] Target arguments: ${JSON.stringify(toolCall.args)}`);
  console.log("  [ASK_USER Handler] Simulating user review... Decision: DENY.");
  return false;
}

async function main() {
  console.log("  === Tool Call Policies Demo ===");

  // Configure policies using the recommended "Deny by Default" posture.
  // Priority order: Specific Deny > Specific Ask > Specific Allow > Wildcard Deny.
  const safetyPolicies = [
    // 1. Deny everything by default
    policy.denyAll(),
    // 2. Allow reading directory contents
    policy.allow(BuiltinTools.LIST_DIR),
    // 3. Allow running commands, but block dangerous 'rm' commands
    policy.allow(BuiltinTools.RUN_COMMAND),
    policy.deny(BuiltinTools.RUN_COMMAND, {
      when: blockRmPredicate,
      name: "block-rm"
    }),
    // 4. Allow editing/creating files, but ask the user first if it's a critical file.
    policy.allow(BuiltinTools.EDIT_FILE),
    policy.allow(BuiltinTools.CREATE_FILE),
    policy.askUser(BuiltinTools.EDIT_FILE, {
      handler: programmaticApprovalHandler,
      when: criticalFilePredicate,
      name: "ask-for-critical-edits"
    }),
    policy.askUser(BuiltinTools.CREATE_FILE, {
      handler: programmaticApprovalHandler,
      when: criticalFilePredicate,
      name: "ask-for-critical-creates"
    })
  ];

  const config = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    policies: safetyPolicies
  });

  await Agent.run(config, async (my_agent) => {
    console.log("\n  Chatting with agent...");

    // Try a safe command (should be allowed)
    const prompt1 = "List the files in the current directory.";
    console.log(`\n  User: ${prompt1}`);
    const response1 = await my_agent.chat(prompt1);
    const text1 = await response1.text();
    console.log(`  Agent: ${text1}`);

    // Try a dangerous command (should be denied by policy)
    const prompt2 = "Delete all files using rm -rf.";
    console.log(`\n  User: ${prompt2}`);
    const response2 = await my_agent.chat(prompt2);
    const text2 = await response2.text();
    console.log(`  Agent: ${text2}`);

    // Try creating a critical file (triggers programmatic ask_user handler)
    const prompt3 = "Create a new configuration file named production.key with content 'debug=true'.";
    console.log(`\n  User: ${prompt3}`);
    const response3 = await my_agent.chat(prompt3);
    const text3 = await response3.text();
    console.log(`  Agent: ${text3}`);
  });
}

main().catch(console.error);
