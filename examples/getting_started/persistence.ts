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
 * Example demonstrating stateful session resumption in Google Antigravity SDK.
 *
 * This example shows how to persist conversation state across process restarts
 * using a conversation ID and a storage directory.
 *
 * To run:
 *   pnpm ts-node examples/getting_started/persistence.ts
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";

async function main() {
  const saveDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent_session_"));
  console.log(`  Save directory: ${saveDir}`);

  console.log("\n  === Session 1: establishing context ===");

  // Specify `save_dir` to ensure conversation history and artifacts are persisted to disk.
  const config1 = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    save_dir: saveDir
  });

  let conversation_id: string = "";

  await Agent.run(config1, async (my_agent1) => {
    const prompt1 = "Remember this: my favorite color is blue.";
    console.log(`  User: ${prompt1}`);
    const response1 = await my_agent1.chat(prompt1);
    const text1 = await response1.text();
    console.log(`  Agent: ${text1}`);

    // Read back the conversation_id assigned by the runtime.
    conversation_id = my_agent1.conversationId;
    console.log(`  Assigned conversation ID: ${conversation_id}`);
  });

  console.log("  Session 1 ended.\n");

  console.log("  === Session 2: resuming and verifying recall ===");

  // By providing the exact same `save_dir` and the prior `conversation_id`,
  // the new agent instance automatically restores the previous conversation history and context.
  const config2 = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    conversation_id: conversation_id,
    save_dir: saveDir
  });

  await Agent.run(config2, async (my_agent2) => {
    const prompt2 = "What is my favorite color?";
    console.log(`  User: ${prompt2}`);
    const response2 = await my_agent2.chat(prompt2);
    const text2 = await response2.text();
    console.log(`  Agent: ${text2}`);
  });

  console.log("  Session 2 ended.");
}

main().catch(console.error);
