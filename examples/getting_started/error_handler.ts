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
 * Example of handling errors in Google Antigravity SDK.
 *
 * This example demonstrates:
 * 1. Using a class implementing OnToolErrorHook to intercept tool errors and
 *    provide guidance to the model.
 * 2. Catching specific SDK exceptions in application code using try...catch
 *    blocks.
 *
 * To run:
 *   pnpm ts-node examples/getting_started/error_handler.ts
 */

import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";
import {
  OnToolErrorHook,
  HookContext,
  AntigravityValidationError,
  AntigravityConnectionError
} from "../../src/index.js";

// Define a tool that always fails.
// This simplifies the example by guaranteeing an error occurs when called.
async function exploding_tool(args: { input_data: string }): Promise<string> {
  console.log(`\n  🔧 [Tool] Exploding tool called with: ${args.input_data}, exploding...`);
  throw new Error("This tool is intentionally broken and always fails.");
}

// Define the error handler hook class.
class MyOnToolErrorHook implements OnToolErrorHook {
  async run(_context: HookContext, err: Error): Promise<string | null> {
    console.log(`\n  🔧 [ErrorHandler] Caught exception: ${err.message}`);

    if (err.message.includes("intentionally broken")) {
      // Return a message that the model will see instead of the raw error.
      // This guides the model on how to respond or recover.
      return `[Tool Error: ${err.message} Please inform the user that the operation failed.]`;
    }

    // Return null to let default error handling take over
    return null;
  }
}

async function main() {
  console.log("  🔌 Error Handling Example\n");

  const tool_error_handler = new MyOnToolErrorHook();

  // Create the agent configuration with the tool and hook.
  const config = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    tools: [exploding_tool],
    hooks: [tool_error_handler]
  });

  await Agent.run(config, async (my_agent) => {
    // Ask the agent to use the tool that we know will fail.
    const prompt = "Use the exploding_tool with input 'test data'.";
    console.log(`  User: ${prompt}`);

    // Catch SDK exceptions in application code.
    try {
      const response = await my_agent.chat(prompt);
      const response_text = await response.text();
      console.log(`  Agent: ${response_text}`);
    } catch (e: any) {
      if (e instanceof AntigravityValidationError) {
        // Triggered when input validation fails.
        console.log(`\n  [App Error] Validation failed: ${e.message}`);
      } else if (e instanceof AntigravityConnectionError) {
        // Triggered when connection issues occur.
        console.log(`\n  [App Error] Connection failed: ${e.message}`);
      } else {
        // Catch-all for other unexpected errors.
        console.log(`\n  [App Error] Unexpected error: ${e.message || e}`);
      }
    }
  });
}

main().catch(console.error);
