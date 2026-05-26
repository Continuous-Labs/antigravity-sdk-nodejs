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
 * Example demonstrating observability features in Google Antigravity SDK.
 *
 * This example shows how to:
 * - Enable basic logging / execution output.
 * - Use hooks to create a basic audit log of tool calls.
 * - Access token usage metadata, including thinking tokens.
 *
 * To run:
 *   pnpm ts-node examples/getting_started/observability.ts
 */

import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";
import { PostToolCallHook, HookContext, ToolResult } from "../../src/index.js";

// A simple tool to demonstrate tool call hooks
function get_weather(args: { location: string }): string {
  return `The weather in ${args.location} is sunny.`;
}

// Use a hook to create a simple audit log for tool calls
class AuditLogToolCallHook implements PostToolCallHook {
  async run(_context: HookContext, data: ToolResult): Promise<void> {
    console.log(`\n  [AUDIT] Tool execution completed. Result: ${JSON.stringify(data)}`);
  }
}

async function main() {
  const config = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    tools: [get_weather],
    hooks: [new AuditLogToolCallHook()]
  });

  await Agent.run(config, async (my_agent) => {
    const prompt = "What is the weather in Seattle?";
    console.log(`  User: ${prompt}`);

    const response = await my_agent.chat(prompt);

    // Stream the response to stdout
    console.log("  Agent: ");
    for await (const chunk of response) {
      process.stdout.write(chunk);
    }
    console.log();

    // Access token usage
    const usage = my_agent.conversation.totalUsage;
    console.log("\n  --- Token Usage ---");
    console.log(`  Prompt tokens: ${usage.prompt_token_count ?? 0}`);
    console.log(`  Output tokens: ${usage.candidates_token_count ?? 0}`);
    console.log(`  Thinking tokens: ${usage.thoughts_token_count ?? 0}`);
    console.log(`  Total tokens: ${usage.total_token_count ?? 0}`);
  });
}

main().catch(console.error);
