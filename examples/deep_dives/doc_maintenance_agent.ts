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
 * Agent example that maintains documentation.
 *
 * To run:
 *   pnpm ts-node examples/deep_dives/doc_maintenance_agent.ts [directory] [--prompt "custom prompt"]
 */

import * as path from "path";
import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";
import {
  PreToolCallDecideHook,
  HookContext,
  HookResult,
  ToolCall,
  policy
} from "../../src/index.js";

const TOOL_NAME_MAPPING: Record<string, string> = {
  view_file: "Viewing Files",
  list_directory: "Listing Directory",
  search_directory: "Searching Directory",
  find_file: "Finding Files",
  edit_file: "Editing Files"
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
  let prompt = "Check all documentation in the target directory and ensure it matches the code. Fix any discrepancies you find.";

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

  // Define policies: allow reading, list, and edit MD files only within targetDir.
  const isAllowedMdFile = (toolArgs: Record<string, any>): boolean => {
    let p = toolArgs.path || toolArgs.file_path || toolArgs.TargetFile || "";
    if (!p) {
      return false;
    }
    if (p.startsWith("file://")) {
      p = p.slice("file://".length);
    }
    const absPath = path.resolve(p);
    return absPath.endsWith(".md") && absPath.startsWith(targetDir);
  };

  const safetyPolicies = [
    policy.allow("view_file"),
    policy.allow("list_directory"),
    policy.allow("search_directory"),
    policy.allow("find_file"),
    policy.allow("edit_file", {
      when: isAllowedMdFile,
      name: "allow-edit-md-only-in-target"
    }),
    policy.deny("*", { name: "deny-all-else" })
  ];

  const systemInstructions =
    "You are an expert Technical Writer and Documentation Agent for the" +
    " Google Antigravity SDK. Your goal is to create and maintain" +
    " high-quality documentation surfaced to third-party" +
    " developers.\n\nGuidelines:\n1. **Audience**: Write for external" +
    " developers. Assume they know nothing about Google-internal" +
    " infrastructure. Use clear, professional, and accessible language." +
    " Avoid internal jargon.\n2. **Focus & Coverage**: Prioritize the public" +
    " API surface. You must ensure that 100% of the public TypeScript code" +
    " (classes, functions, public methods) is covered by high-quality" +
    " documentation. This includes detailed docstrings and" +
    " inclusion in relevant markdown guides.\n3. **Examples**: Create and" +
    " maintain realistic 'Hello World' and usage examples for all featured" +
    " capabilities. All code snippets in documentation MUST be complete," +
    " copy-pasteable, and verified against the actual code or unit tests. Do" +
    " not use trivial System Instructions like 'You are a helpful" +
    " assistant.' in examples.\n4. **Verification**: When adding or updating" +
    " documentation containing code snippets, verify that the snippets" +
    " accurately reflect the current API usage by cross-referencing with" +
    " source code and unit tests.\n5. **Terminology**: Always use 'Layer'" +
    " instead of 'Tier' to refer to SDK architecture layers, and always use" +
    " 'Google Antigravity SDK' instead of 'Antigravity SDK' to refer to the" +
    " SDK.\n6. **Action**: Read the source code in the project directory and" +
    " ensure the corresponding README.md and guide files are accurate and" +
    " up-to-date. Apply fixes directly to .md files within the target" +
    " directory. You are ONLY allowed to edit .md files within the target" +
    " directory. The target directory is: " + targetDir;

  console.log("Creating Doc Maintenance Agent...");
  const config = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    system_instructions: systemInstructions,
    policies: safetyPolicies,
    hooks: [new PrintToolCallHook()],
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
