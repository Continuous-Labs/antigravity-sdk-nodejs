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
 * Agent example that maintains docstrings in TypeScript/JavaScript files.
 *
 * To run:
 *   pnpm ts-node examples/deep_dives/docstring_maintenance_agent.ts [directory] [--prompt "custom prompt"]
 */

import * as path from "path";
import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";
import {
  PreToolCallDecideHook,
  HookContext,
  HookResult,
  ToolCall,
  policy,
  BuiltinTools
} from "../../src/index.js";

const TOOL_NAME_MAPPING: Record<string, string> = {
  [BuiltinTools.VIEW_FILE]: "Viewing Files",
  [BuiltinTools.LIST_DIR]: "Listing Directory",
  [BuiltinTools.SEARCH_DIR]: "Searching Directory",
  [BuiltinTools.FIND_FILE]: "Finding Files",
  [BuiltinTools.EDIT_FILE]: "Editing Files"
};

class PrintToolCallHook implements PreToolCallDecideHook {
  async run(_context: HookContext, data: ToolCall): Promise<HookResult> {
    const plainName = TOOL_NAME_MAPPING[data.name] || data.name;

    // Try to find a path-like argument
    let pathArg = "";
    for (const key of ["file_path", "path", "directory_path", "TargetFile"]) {
      if (key in data.args) {
        pathArg = data.args[key];
        break;
      }
    }

    if (pathArg) {
      if (pathArg.startsWith("file://")) {
        pathArg = pathArg.slice("file://".length);
      }
      console.log(`${plainName}: ${pathArg}`);
    } else {
      console.log(`${plainName} with arguments: ${JSON.stringify(data.args)}`);
    }

    return { allow: true };
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let directory = process.cwd();
  let prompt = "Audit all TypeScript files in the target directory and ensure all public symbols have JSDoc/TSDoc docstrings. Add or update docstrings as needed.";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--prompt" && i + 1 < args.length) {
      prompt = args[i + 1];
      i++;
    } else if (!args[i].startsWith("--")) {
      directory = args[i];
    }
  }

  return { directory, prompt };
}

async function main() {
  const { directory, prompt } = parseArgs();
  const targetDir = path.resolve(directory);
  console.log(`Target directory: ${targetDir}`);

  // Define policies: allow read, list, and edit TS files within targetDir.
  const isAllowedTsFile = (toolArgs: Record<string, any>): boolean => {
    let p = toolArgs.path || toolArgs.file_path || toolArgs.TargetFile || "";
    if (!p) {
      return false;
    }
    if (p.startsWith("file://")) {
      p = p.slice("file://".length);
    }
    const absPath = path.resolve(p);
    return absPath.endsWith(".ts") && absPath.startsWith(targetDir);
  };

  const safetyPolicies = [
    policy.allow(BuiltinTools.VIEW_FILE),
    policy.allow(BuiltinTools.LIST_DIR),
    policy.allow(BuiltinTools.SEARCH_DIR),
    policy.allow(BuiltinTools.FIND_FILE),
    policy.allow(BuiltinTools.EDIT_FILE, {
      when: isAllowedTsFile,
      name: "allow-edit-ts-only-in-target"
    }),
    policy.deny("*", { name: "deny-all-else" })
  ];

  const systemInstructions =
    "You are an expert Technical Writer and Docstring Maintenance Agent for" +
    " the Google Antigravity SDK. Your goal is to ensure that 100% of the" +
    " public TypeScript code (classes, functions, public methods, interfaces) is covered by" +
    " high-quality docstrings following TSDoc/JSDoc standards.\n\nGuidelines:\n1. **Focus**: Audit all TypeScript files in the" +
    " target directory. Identify public symbols lacking docstrings or having" +
    " incomplete docstrings.\n2. **Style**: Use JSDoc/TSDoc style for docstrings." +
    " Include tags like @param, @returns, and @throws where" +
    " applicable.\n3. **Safety**: You are ONLY allowed to add or update" +
    " docstrings. Do NOT modify any implementation code, logic, or variable" +
    " definitions. Your edits must be strictly limited to docstring" +
    " blocks.\n4. **Action**: Apply fixes directly to .ts files within the" +
    " target directory. You are ONLY allowed to edit .ts files within the" +
    " target directory. The target directory is: " + targetDir + "\n5." +
    " **Branding**: Always use 'Google Antigravity SDK' instead of" +
    " 'Antigravity SDK' when referring to the SDK.";

  console.log("Creating Docstring Maintenance Agent...");

  const config = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    system_instructions: systemInstructions,
    policies: safetyPolicies,
    hooks: [new PrintToolCallHook()],
    capabilities: {
      disabled_tools: [
        BuiltinTools.CREATE_FILE,
        BuiltinTools.RUN_COMMAND,
        BuiltinTools.ASK_QUESTION,
        BuiltinTools.START_SUBAGENT,
        BuiltinTools.GENERATE_IMAGE,
        BuiltinTools.FINISH
      ]
    },
    workspaces: [targetDir]
  });

  await Agent.run(config, async (agent) => {
    console.log("\nStreaming agent output:");
    const response = await agent.chat(prompt);
    for await (const chunk of response) {
      process.stdout.write(chunk);
    }
    console.log();
  });
}

main().catch(console.error);
