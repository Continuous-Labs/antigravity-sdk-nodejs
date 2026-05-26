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
import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";

async function main(): Promise<void> {
  // Load the real 'google-antigravity-sdk' skill
  const skillPath = path.resolve(process.cwd(), "skills/google-antigravity-sdk");

  console.log(`  Loading skills from: ${skillPath}`);

  // Configure the agent with the skills path.
  const config = new LocalAgentConfig({
    skills_paths: [skillPath]
  });

  await Agent.run(config, async (agent) => {
    const prompt = "What available skills do you have?";
    console.log(`  User: ${prompt}`);

    const response = await agent.chat(prompt);
    const responseText = await response.text();
    console.log(`  Agent: ${responseText}`);
  });
}

main().catch(console.error);
