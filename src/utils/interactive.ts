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

import * as readline from "readline";
import { Agent } from "../agent.js";
import {
  ToolCall,
  HookResult,
  AskQuestionInteractionSpec,
  QuestionHookResult,
  QuestionResponse,
  BuiltinTools
} from "../types.js";
import { HookContext, PreToolCallDecideHook, OnInteractionHook } from "../hooks/hooks.js";
import { Policy, Decision, askUser, enforce, PolicyDecideHook } from "../hooks/policy.js";

/**
 * Async version of readline prompt.
 */
export function asyncInput(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

export class ToolConfirmationHook implements PreToolCallDecideHook {
  async run(_context: HookContext, data: ToolCall): Promise<HookResult> {
    console.log(`\nTool execution requested: ${data.name}`);
    if (data.args) {
      console.log(`Arguments: ${JSON.stringify(data.args)}`);
    }

    try {
      const ans = await asyncInput("Allow execution? (y/n) [n]: ");
      if (ans.trim().toLowerCase() === "y" || ans.trim().toLowerCase() === "yes") {
        return { allow: true };
      }
    } catch {
      // Ignored
    }
    return { allow: false, message: "User denied tool call." };
  }
}

export async function askUserHandler(tc: ToolCall): Promise<boolean> {
  console.log(`\nPolicy check: Tool execution requested: ${tc.name}`);
  if (tc.args) {
    console.log(`Arguments: ${JSON.stringify(tc.args)}`);
  }

  try {
    const ans = await asyncInput("Allow execution? (y/n) [n]: ");
    return ans.trim().toLowerCase() === "y" || ans.trim().toLowerCase() === "yes";
  } catch {
    return false;
  }
}

export class AskQuestionHook implements OnInteractionHook {
  async run(_context: HookContext, data: AskQuestionInteractionSpec): Promise<QuestionHookResult> {
    const questions = data.questions;
    const responses: QuestionResponse[] = [];

    try {
      for (const q of questions) {
        console.log(`\nQuestion: ${q.question}`);
        const options = q.options || [];
        for (let idx = 0; idx < options.length; idx++) {
          console.log(`  ${idx + 1}. ${options[idx].text}`);
        }

        const ans = (await asyncInput("Response: ")).trim();
        if (!ans) {
          responses.push({ skipped: true });
          continue;
        }

        // Try to match by option number
        let matchedId: string | undefined;
        if (options.length > 0) {
          try {
            const selectedIdx = parseInt(ans, 10) - 1;
            if (selectedIdx >= 0 && selectedIdx < options.length) {
              matchedId = options[selectedIdx].id;
            }
          } catch {
            // Ignored
          }

          // Try to match by exact option text or ID
          if (!matchedId) {
            for (const opt of options) {
              if (
                ans.toLowerCase() === opt.text.toLowerCase() ||
                ans.toLowerCase() === opt.id.toLowerCase()
              ) {
                matchedId = opt.id;
                break;
              }
            }
          }
        }

        if (matchedId) {
          responses.push({ selected_option_ids: [matchedId] });
        } else {
          responses.push({ freeform_response: ans });
        }
      }
    } catch {
      return { responses, cancelled: true };
    }

    return { responses };
  }
}

export function upgradeToInteractiveConfirmation(agent: Agent): void {
  const config = agent.config;
  if (!config.policies) {
    return;
  }

  const upgraded: Policy[] = [];
  for (const p of config.policies) {
    if (
      p.tool === BuiltinTools.RUN_COMMAND &&
      p.decision === Decision.DENY &&
      !p.when
    ) {
      upgraded.push(
        askUser(BuiltinTools.RUN_COMMAND, {
          handler: askUserHandler,
          name: p.name || "interactive_confirm"
        })
      );
    } else {
      upgraded.push(p);
    }
  }

  config.policies = upgraded;
  const newHook = enforce(upgraded);
  const runner = (agent as any)._hookRunner;
  if (runner) {
    const hooksList = runner._preToolCallDecideHooks;
    for (let i = 0; i < hooksList.length; i++) {
      if (hooksList[i] instanceof PolicyDecideHook) {
        hooksList[i] = newHook;
        return;
      }
    }
    hooksList.push(newHook);
  }
}

export async function runInteractiveLoop(agent: Agent): Promise<void> {
  if (!agent.isStarted) {
    throw new Error("Agent session not started. Use 'Agent.run(...)'.");
  }

  agent.registerHook(new AskQuestionHook());
  upgradeToInteractiveConfirmation(agent);

  console.log("Starting interactive loop. Type 'exit' or 'quit' to end.");
  while (true) {
    try {
      const userInput = (await asyncInput("User: ")).trim();
      if (!userInput) {
        continue;
      }
      if (userInput.toLowerCase() === "exit" || userInput.toLowerCase() === "quit") {
        console.log("Goodbye!");
        break;
      }

      await agent.conversation.send(userInput);

      // In Node.js conversation stream:
      const steps = agent.conversation.receiveSteps();
      for await (const step of steps) {
        if (step.is_complete_response) {
          console.log(`Agent: ${step.content}`);
        }
      }
    } catch (e) {
      console.log("\nGoodbye!");
      break;
    }
  }
}
