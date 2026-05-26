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

import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";

async function main(): Promise<void> {
  const customAppData = path.join(os.tmpdir(), `agent_appdata_${Date.now()}`);
  console.log(`  Custom App Data Dir: ${customAppData}\n`);

  // Initialize the agent config with our custom app_data_dir override
  const config = new LocalAgentConfig({
    app_data_dir: customAppData
  });

  // Start the agent and ask it to create an artifact
  await Agent.run(config, async (agent) => {
    console.log(`  Agent Session Started. Conversation ID: ${agent.conversationId}\n`);

    const prompt = "Please create an artifact file named 'nodejs_best_practices.md' summarizing Node.js best practices.";
    console.log(`  User:  ${prompt}`);
    const response = await agent.chat(prompt);
    const responseText = await response.text();
    console.log(`  Agent: ${responseText}\n`);

    // Verify that the artifact was successfully stored in our custom app_data_dir
    const expectedArtifactPath = path.join(
      customAppData,
      "brain",
      agent.conversationId || "",
      "nodejs_best_practices.md"
    );

    console.log(`  Checking artifact location: ${expectedArtifactPath}`);
    if (fs.existsSync(expectedArtifactPath)) {
      console.log("\n  SUCCESS: Verified artifact successfully stored in custom app_data_dir!");
    } else {
      console.log("\n  WARNING: Artifact was not found in custom app_data_dir.");
    }
  });
}

main().catch(console.error);
