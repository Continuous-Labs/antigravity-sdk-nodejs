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
 * Example demonstrating system instructions in Google Antigravity SDK.
 *
 * This example shows how to configure the agent's system instructions using both
 * templated and custom approaches.
 *
 * To run:
 *   pnpm ts-node examples/getting_started/persona_config.ts
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";
import {
  TemplatedSystemInstructions,
  CustomSystemInstructions,
  SystemInstructionSection
} from "../../src/index.js";

function check_style_guide(args: { language: string }): string {
  if (args.language.toLowerCase() === "python") {
    return "Use snake_case for functions and variables. Use CamelCase for classes.";
  }
  return "No specific rules found.";
}

async function runTemplatedExample() {
  console.log("  === Templated System Instructions Example ===");

  const identity =
    "You are an expert Code Quality Reviewer.\nYour role is to review code" +
    " for readability, maintainability, and adherence to style guides.";

  const reviewCriteria: SystemInstructionSection = {
    title: "review_criteria",
    content: "- Focus on readability and simplicity.\n- Ensure meaningful variable and function names."
  };

  const styleGuideInstructions: SystemInstructionSection = {
    title: "style_guide_instructions",
    content: "When reviewing Python code, use the `check_style_guide` tool to verify rules."
  };

  const templatedSi: TemplatedSystemInstructions = {
    identity: identity,
    sections: [reviewCriteria, styleGuideInstructions]
  };

  const config = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    system_instructions: templatedSi,
    tools: [check_style_guide]
  });

  await Agent.run(config, async (my_agent) => {
    const prompt = "Review this Python code: `def MY_FUNCTION(X): return X*2`";
    console.log(`  User: ${prompt}`);
    const response = await my_agent.chat(prompt);
    const text = await response.text();
    console.log(`  Agent: ${text}\n`);
  });
}

function buildSkillsInstructions(skillsPaths: string[]): string {
  if (!skillsPaths.length) {
    return "";
  }

  let instructions = "\n<skills>\n";
  instructions += "Skills enhance your abilities with specialized expertise and repeatable workflows to help solve advanced workflows.\n";
  instructions += "When a task matches an available skill's description, you must inspect the complete SKILL.md with your 'view_file' tool in order to understand its capabilities.\n\n";
  instructions += "Available skills:\n";
  for (const p of skillsPaths) {
    const skillName = path.basename(p);
    instructions += `* **${skillName}** (located at \`${p}/SKILL.md\`) — Provides guidelines for code readability, style compliance, and refactoring.\n`;
  }
  instructions += "</skills>\n";
  return instructions;
}

async function runCustomExample() {
  console.log("  === Custom System Instructions Example ===");

  const identityText = `
<identity>
You are an expert Code Quality Reviewer agent. Your goal is to help developers maintain high standards of readability, maintainability, and correctness in their code. You will receive code snippets or descriptions of code changes and provide actionable feedback. You must always prioritize addressing the user's specific questions or concerns about the code.
</identity>
`;

  const cwd = process.cwd();
  const appDataDir = path.expandUser ? path.expandUser("~/.gemini/antigravity") : path.join(os.homedir(), ".gemini/antigravity");
  const userInfo = `
<user_information>
Operating System: ${process.platform}
Active Workspace CWD: ${cwd}
Storage Directory (App Data): ${appDataDir}
</user_information>
`;

  const skillPath = path.resolve("skills/google-antigravity-sdk");
  const skills = [skillPath];
  const skillsInstructions = buildSkillsInstructions(skills);

  const guidelinesText = `
<review_guidelines>
### When to recommend refactoring:
- The code has high cyclomatic complexity (too many nested loops/conditionals).
- The code violates DRY (Don't Repeat Yourself) principles significantly.
- The code is difficult to unit test in its current form.

### Don't recommend refactoring for:
- Minor personal style preferences that don't impact readability.
- Micro-optimizations that make the code harder to understand.
</review_guidelines>

<task_management>
### When to suggest breaking up the review:
- If the provided code snippet is longer than 200 lines.
- If the user is asking for both a security audit and a performance review at the same time.
In these cases, suggest reviewing one specific aspect or file first.
</task_management>

<behavioral_principles>
1. **Acknowledge Ambiguity**: If a request is underspecified or could be interpreted in multiple ways, ask the user for clarification before proceeding.
2. **Precision**: When suggesting code changes, always specify the file path and, if applicable, the line range.
3. **Focus on Delta**: Do not restate full file contents or large blocks of code unless necessary. Focus only on what needs to change.
4. **Closure**: End every turn with a clear summary of what was accomplished and what the next steps are.
</behavioral_principles>

<review_artifact_format>
When generating a detailed review artifact in Markdown, use the following elements to ensure high quality and scannability:

### Alerts
Use GitHub-style alerts to highlight critical issues:
> [!IMPORTANT]
> Critical security or correctness issues that must be fixed.

> [!NOTE]
> General improvements or style suggestions.

### Code Diffs
When suggesting changes, use diff blocks to show exactly what to add or remove:
\`\`\`diff
-def old_func():
+def new_func():
\`\`\`

### Tables
Use tables to compare alternative approaches or list multiple findings:
| File | Line | Issue | Severity |
| :--- | :--- | :--- | :--- |
| main.py | 12 | Hardcoded API key | Critical |
</review_artifact_format>

<tool_usage>
You have access to the \`check_style_guide\` tool. When reviewing Python code, always use this tool to verify language-specific style rules before making recommendations.
</tool_usage>
`;

  const finalSiPrompt = identityText + skillsInstructions + guidelinesText + userInfo;
  const customSi: CustomSystemInstructions = { text: finalSiPrompt };

  const config = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    system_instructions: customSi,
    tools: [check_style_guide],
    skills_paths: skills
  });

  await Agent.run(config, async (my_agent) => {
    const prompt = "Review this Python code: `def foo(x): return x+1`";
    console.log(`  User: ${prompt}`);
    const response = await my_agent.chat(prompt);
    const text = await response.text();
    console.log(`  Agent: ${text}\n`);
  });
}

async function main() {
  await runTemplatedExample();
  await runCustomExample();
}

main().catch(console.error);
