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
import { policy } from "../../src/index.js";

async function main(): Promise<void> {
  // allowAll() grants the agent full access to all tools, including
  // run_command (shell execution). This overrides the default
  // confirmRunCommand() policy.
  const config = new LocalAgentConfig({
    policies: [policy.allowAll()]
  });

  await Agent.run(config, async (agent) => {
    const prompt = "Run 'echo Hello from the shell!' and show me the output.";
    console.log(`  User: ${prompt}`);

    const response = await agent.chat(prompt);
    const responseText = await response.text();
    console.log(`  Agent: ${responseText}`);
  });
}

main().catch(console.error);
