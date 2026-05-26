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
 * Example demonstrating custom tools and stateful tools with ToolContext.
 *
 * This example shows:
 * 1. How to define a simple custom tool.
 * 2. How to define a stateful tool using ToolContext to maintain state
 *    across turns.
 *
 * To run:
 *   pnpm ts-node examples/getting_started/custom_tools.ts
 */

import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";
import { ToolContext, policy } from "../../src/index.js";

// 1. Define a simple tool
function lookup_fruit_sku(args: { fruit_name: string }): string {
  const skus: Record<string, string> = {
    apple: "SKU-APP-123",
    banana: "SKU-BAN-456",
    orange: "SKU-ORA-789"
  };

  let name = args.fruit_name.toLowerCase();
  if (name.endsWith("s") && !skus[name]) {
    name = name.slice(0, -1);
  }
  const sku = skus[name] || "SKU-GEN-000";
  return `SKU for ${args.fruit_name} is ${sku}. Order ID for restocking: ORD-${sku}-NEW`;
}

// 2. Define a stateful tool using injected ToolContext
function record_fruit(args: { sku: string; count: number }, ctx: ToolContext): string {
  // Retrieve current state or initialize if not present
  const fruitCounts = ctx.getState<Record<string, number>>("fruit_counts") || {};

  // Update state
  const currentCount = fruitCounts[args.sku] || 0;
  fruitCounts[args.sku] = currentCount + args.count;
  ctx.setState("fruit_counts", fruitCounts);

  const total = fruitCounts[args.sku];
  return `Recorded ${args.count} units for ${args.sku}. Total count is now ${total}.`;
}

async function main() {
  // Configure the agent with both tools.
  const config = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    tools: [lookup_fruit_sku, record_fruit],
    system_instructions:
      "You keep track of fruit inventory. To record fruits, you MUST" +
      " first look up the fruit's SKU using lookup_fruit_sku, and then" +
      " use that SKU with record_fruit.",
    policies: [
      // Deny everything by default so only the tools below are allowed
      policy.denyAll(),
      policy.allow("lookup_fruit_sku"),
      policy.allow("record_fruit")
    ]
  });

  await Agent.run(config, async (my_agent) => {
    console.log("  === Custom Tools Demo ===");

    // Test simple tool
    const prompt1 = "What is the SKU for apples? We need to order more.";
    console.log(`\n  User: ${prompt1}`);
    const response1 = await my_agent.chat(prompt1);
    const text1 = await response1.text();
    console.log(`  Agent: ${text1}`);

    // Test stateful tool
    console.log("\n  === Stateful Tool (Fruit Counter) Demo ===");

    const turns = [
      "I have 5 apples.",
      "And I just got 3 bananas.",
      "Oh, and another 2 apples."
    ];

    for (const userInput of turns) {
      console.log(`\n  User: ${userInput}`);
      const response = await my_agent.chat(userInput);
      const text = await response.text();
      console.log(`  Agent: ${text}`);
    }
  });
}

main().catch(console.error);
