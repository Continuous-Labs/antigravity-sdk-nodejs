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
 * Example demonstrating end-to-end flow with LocalConnection.
 *
 * This example shows how to:
 * 1. Define a custom TS tool and register it.
 * 2. Connect an MCP server (pirate math tools).
 * 3. Configure hook-based tool approval policy with CLI interaction.
 * 4. Run an interactive conversation loop with full telemetry.
 *
 * To run:
 *   pnpm ts-node examples/deep_dives/interactive_cli.ts [--show-usage] [--disable-run-command]
 */

import * as fs from "fs";
import * as path from "path";
import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";
import {
  policy,
  interactive,
  BuiltinTools,
  McpServerConfig,
  UsageMetadata,
  Step
} from "../../src/index.js";

let _MODEL_NAME = "gemini-3.5-flash";
let _SYSTEM_INSTRUCTION: string | null = null;
let _DISABLE_RUN_COMMAND = false;
let _SHOW_USAGE = false;

function read_file_upside_down(args: { path: string }): string {
  console.log(`[Tool] read_file_upside_down called with path: ${args.path}`);
  const resolved = path.resolve(args.path);
  const content = fs.readFileSync(resolved, "utf-8");
  return content.split("\n").reverse().join("\n");
}

function printTelemetry(
  turnUsage: UsageMetadata | null | undefined,
  cumul: UsageMetadata,
  history: Step[]
) {
  console.log("\n--- Turn Token Usage ---");
  if (turnUsage) {
    console.log(`  Prompt tokens:   ${turnUsage.prompt_token_count ?? 0}`);
    console.log(`  Cached tokens:   ${turnUsage.cached_content_token_count ?? 0}`);
    console.log(`  Output tokens:   ${turnUsage.candidates_token_count ?? 0}`);
    console.log(`  Thinking tokens: ${turnUsage.thoughts_token_count ?? 0}`);
    console.log(`  Total tokens:    ${turnUsage.total_token_count ?? 0}`);
  } else {
    console.log("  Usage data not available for this turn.");
  }

  // Cumulative session usage.
  console.log("\n--- Session Cumulative Usage ---");
  console.log(`  Prompt tokens:   ${cumul.prompt_token_count ?? 0}`);
  console.log(`  Cached tokens:   ${cumul.cached_content_token_count ?? 0}`);
  console.log(`  Output tokens:   ${cumul.candidates_token_count ?? 0}`);
  console.log(`  Thinking tokens: ${cumul.thoughts_token_count ?? 0}`);
  console.log(`  Total tokens:    ${cumul.total_token_count ?? 0}`);

  // Trajectory summary.
  console.log(`\n--- Trajectory (${history.length} steps) ---`);
  history.forEach((s, i) => {
    let label = `    [${i}] ${s.type} (${s.source}) - ${s.status}`;
    if (s.tool_calls && s.tool_calls.length > 0) {
      const names = s.tool_calls.map((tc) => tc.name).join(", ");
      label += ` [${names}]`;
    }
    console.log(label);
  });
  console.log();
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--show-usage") {
      _SHOW_USAGE = true;
    } else if (args[i] === "--disable-run-command") {
      _DISABLE_RUN_COMMAND = true;
    } else if (args[i] === "--model" && i + 1 < args.length) {
      _MODEL_NAME = args[i + 1];
      i++;
    } else if (args[i] === "--system-instruction" && i + 1 < args.length) {
      _SYSTEM_INSTRUCTION = args[i + 1];
      i++;
    }
  }
}

async function main() {
  parseCliArgs();

  const mcpServerPath = path.resolve("examples/resources/mcp_server.ts");
  const mcpServer: McpServerConfig = {
    type: "stdio",
    command: "npx",
    args: ["ts-node", mcpServerPath, "--transport=stdio"]
  };

  const config = new LocalAgentConfig({
    model: _MODEL_NAME,
    tools: [read_file_upside_down],
    mcp_servers: [mcpServer],
    policies: [policy.askUser("*", { handler: interactive.askUserHandler })],
    hooks: [new interactive.AskQuestionHook()],
    capabilities: {
      disabled_tools: _DISABLE_RUN_COMMAND ? [BuiltinTools.RUN_COMMAND] : undefined
    },
    system_instructions: _SYSTEM_INSTRUCTION
  });

  console.log("\nGoogle Antigravity SDK Demo");
  console.log("Type your message and press Enter • Ctrl+C to exit\n");

  await Agent.run(config, async (agent) => {
    while (true) {
      try {
        const userInput = (await interactive.asyncInput("\n→ ")).trim();
        if (!userInput) {
          continue;
        }
        if (userInput.toLowerCase() === "exit" || userInput.toLowerCase() === "quit") {
          console.log("\nGoodbye! 👋");
          break;
        }

        const response = await agent.chat(userInput);

        // Stream the response to stdout
        for await (const chunk of response) {
          process.stdout.write(chunk);
        }
        console.log();

        if (_SHOW_USAGE) {
          printTelemetry(
            response.usageMetadata,
            agent.conversation.totalUsage,
            agent.conversation.history
          );
        }
      } catch {
        console.log("\nGoodbye! 👋");
        break;
      }
    }
  });
}

main().catch(console.error);
