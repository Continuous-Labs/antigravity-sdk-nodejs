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

import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";
import { BuiltinTools, ToolCall, ToolResult, HookResult } from "../../src/types.js";
import { Hook, HookContext } from "../../src/hooks/hooks.js";

let subagentActive = false;

// Custom hook to intercept and log pre-tool-call decisions
class LogPreToolHook implements Hook<ToolCall, HookResult> {
  async run(_context: HookContext, data: ToolCall): Promise<HookResult> {
    if (data.name === BuiltinTools.START_SUBAGENT) {
      subagentActive = true;
      console.log("\n  --- 🤖 [Hook] Spawning Subagent ---");
      console.log(`  Arguments: ${JSON.stringify(data.args)}\n`);
    } else {
      const indent = subagentActive ? "    " : "  ";
      console.log(`${indent}- [Start]: ${data.name} (ID: ${data.id})`);
    }
    return { allow: true };
  }
}

// Custom hook to log post-tool-call successes
class LogPostToolHook implements Hook<ToolResult, void> {
  async run(_context: HookContext, data: ToolResult): Promise<void> {
    if (data.name === BuiltinTools.START_SUBAGENT) {
      subagentActive = false;
      console.log("\n  --- 🤖 [Hook] Subagent Finished ---");
      console.log(`  Result: ${JSON.stringify(data.result)}\n`);
    } else {
      const indent = subagentActive ? "    " : "  ";
      console.log(`${indent}- [Done]: ${data.name} (ID: ${data.id}) ✅`);
    }
  }
}

async function main(): Promise<void> {
  // Enable subagents in the config and add hooks for visibility.
  const config = new LocalAgentConfig({
    capabilities: {
      enable_subagents: true
    },
    hooks: [new LogPreToolHook(), new LogPostToolHook()]
  });

  await Agent.run(config, async (agent) => {
    const prompt = (
      "Use a subagent to research the Google Antigravity SDK examples in the" +
      " parent directory. Delegate the task of listing and reading the files to the" +
      " subagent, and then generate a lesson plan for me to learn more based" +
      " on its findings."
    );
    console.log(`  User: ${prompt}`);

    const response = await agent.chat(prompt);
    const responseText = await response.text();
    console.log(`\n  Agent:\n${responseText}`);
  });
}

main().catch(console.error);
