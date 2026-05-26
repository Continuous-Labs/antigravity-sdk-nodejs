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

// Define the JSON schema for the native structured output
const meetingSummarySchema = {
  type: "object",
  properties: {
    action_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          assignee: { type: "string" },
          task: { type: "string" },
          deadline: { type: "string" }
        },
        required: ["assignee", "task", "deadline"]
      }
    }
  },
  required: ["action_items"]
};

// A custom mock tool that retrieves unstructured text data
async function fetch_unstructured_meeting_notes(args: { meeting_id: string }): Promise<string> {
  console.log(`[Tool] Fetching raw notes for: ${args.meeting_id}`);
  if (args.meeting_id === "meeting-2026-05") {
    return (
      "Discussed launch timeline for project X. Alice agreed to update" +
      " the textproto tests by Monday. Bob mentioned he will run the final" +
      " E2E benchmarks tomorrow. I will push the release build once the" +
      " tests are green."
    );
  }
  return "Error: Meeting notes not found.";
}

async function main(): Promise<void> {
  console.log("  --- Starting main ---");
  const config = new LocalAgentConfig({
    tools: [fetch_unstructured_meeting_notes],
    response_schema: meetingSummarySchema
  });

  await Agent.run(config, async (agent) => {
    const prompt = (
      "Use the fetch_unstructured_meeting_notes tool to retrieve notes for" +
      " 'meeting-2026-05' and return the meeting summary with the appropriate" +
      " action item list. Ensure each action item includes 'assignee'," +
      " 'task', and 'deadline'."
    );

    console.log("\n  Sending prompt to agent...");
    const response = await agent.chat(prompt);

    console.log("\n  Extracting structured meeting action items...");

    const data = await response.structured_output();
    if (!data) {
      console.log("\n  Failed to extract structured summary natively.");
      console.log(`  Final Text Response: ${await response.text()}`);
      return;
    }

    console.log("\n  === Structured Meeting Action Items ===");
    const items = data.action_items || [];
    for (const item of items) {
      console.log(`  - Assignee: ${item.assignee}`);
      console.log(`    Task:     ${item.task}`);
      console.log(`    Deadline: ${item.deadline}\n`);
    }
  });
}

main().catch(console.error);
