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
 * Example demonstrating Human-in-the-Loop interaction in Google Antigravity SDK.
 *
 * This example demonstrates how an agent can pause execution to ask the user
 * for input or clarification using the `AskQuestionHook`.
 *
 * To run:
 *   pnpm ts-node examples/getting_started/human_in_the_loop.ts
 */

import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";
import { interactive } from "../../src/index.js";

async function main() {
  // Default config enables all tools, including ASK_QUESTION.
  const config = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    system_instructions:
      "When you need clarification or more information from the user to " +
      "fulfill a request, you should use the `ask_question` tool to " +
      "prompt them."
  });

  await Agent.run(config, async (my_agent) => {
    // Register the hook to handle questions from the agent.
    my_agent.registerHook(new interactive.AskQuestionHook());

    // We give the agent an ambiguous prompt to encourage it to ask for
    // clarification.
    const prompt = "I want to search for a file.";
    console.log(`  User: ${prompt}`);

    const response = await my_agent.chat(prompt);

    // Stream the response to stdout.
    // The AskQuestionHook will handle the interaction if the agent calls
    // ask_question.
    for await (const chunk of response) {
      process.stdout.write(chunk);
    }
    console.log();
  });
}

main().catch(console.error);
