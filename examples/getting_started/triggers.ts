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
 * Example demonstrating background triggers in Google Antigravity SDK.
 *
 * Triggers are long-lived async functions that run in the background alongside
 * an active agent session. They react to external events (such as timers, file
 * changes, or webhooks) and push automated trigger notifications back to the
 * agent connection.
 *
 * This example demonstrates:
 * 1. Periodic Triggers (using the `every` helper) - Simulating SRE Ticket Queues.
 * 2. Custom Triggers (using the custom trigger runner) - Simulating CI/CD
 *    Webhook listeners.
 *
 * To run:
 *   pnpm ts-node examples/getting_started/triggers.ts
 */

import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";
import { every, trigger, TriggerContext } from "../../src/index.js";

// ==============================================================================
// 1. PERIODIC TRIGGER EXAMPLE: Customer Support Ticket Queue
// ==============================================================================

let _ticketCounter = 0;
let _standbyActive = false;

async function pollQueueCallback(ctx: TriggerContext): Promise<void> {
  if (!_standbyActive) {
    return;
  }

  _ticketCounter += 1;

  if (_ticketCounter === 2) {
    console.log("\n  [TRIGGER EVENT] Alert! New ticket detected in the queue...");
    await ctx.send(
      "[SYSTEM ALERT] New critical ticket assigned: b/98765. Title: " +
      "Database Connection Leak in Prod."
    );
  }
}

async function runPeriodicTriggerExample() {
  console.log("  === Support Queue Trigger Demo ===");
  console.log("  Creating agent and starting session...");

  _ticketCounter = 0;
  _standbyActive = false;

  const myTrigger = every(1, pollQueueCallback);

  const config = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    system_instructions:
      "You are a system operations and support assistant. You monitor a " +
      "queue of incoming support tickets. When the user asks for updates, " +
      "you must check and report any tickets that came in from the " +
      "background system alert trigger.",
    triggers: [myTrigger]
  });

  await Agent.run(config, async (my_agent) => {
    const prompt1 =
      "Your task will be to standby and simply let me know if there are any " +
      "critical tickets received.";
    console.log(`\n  User: ${prompt1}`);
    const response1 = await my_agent.chat(prompt1);
    const text1 = await response1.text();
    console.log(`  Agent: ${text1}`);

    _standbyActive = true;

    console.log("\n  Sleeping for 5 seconds. A new ticket will be simulated in the background...");
    await new Promise((r) => setTimeout(r, 5000));

    const prompt2 = "I'm back. Did anything critical come in while I was working?";
    console.log(`\n  User: ${prompt2}`);
    const response2 = await my_agent.chat(prompt2);
    const text2 = await response2.text();
    console.log(`  Agent: ${text2}`);

    console.log("\n  Ending session. Background triggers will stop automatically.");
  });
}

// ==============================================================================
// 2. CUSTOM TRIGGER EXAMPLE: CI/CD Webhook Alert Listener
// ==============================================================================

let _webhookActive = false;

const webhookListener = trigger(async (ctx: TriggerContext) => {
  console.log("\n  [WEBHOOK TRIGGER] Custom Webhook listener started...");

  let tick = 0;
  while (true) {
    await new Promise((r) => setTimeout(r, 1000));

    if (!_webhookActive) {
      continue;
    }

    tick += 1;
    if (tick === 3) {
      console.log("\n  [WEBHOOK TRIGGER] Event received: 'AppBuild-42' status FAILED.");
      await ctx.send(
        "[WEBHOOK ALERT] CI/CD Build Pipeline 'AppBuild-42' FAILED on " +
        "branch 'main'. Reason: Lint errors in routes.py."
      );
    }
  }
});

async function runCustomTriggerExample() {
  console.log("  === Custom Webhook Trigger Demo ===");
  console.log("  Creating agent and starting session...");

  _webhookActive = false;

  const config = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    system_instructions:
      "You are a CI/CD operations assistant. You monitor pipeline status " +
      "via an external webhook trigger. When the user asks for updates, " +
      "you must check and report any failures that came in from the " +
      "webhook alert trigger.",
    triggers: [webhookListener]
  });

  await Agent.run(config, async (my_agent) => {
    const prompt1 =
      "Your task will be to standby and simply let me know if there are any " +
      "critical pipeline webhook alerts received.";
    console.log(`\n  User: ${prompt1}`);
    const response1 = await my_agent.chat(prompt1);
    const text1 = await response1.text();
    console.log(`  Agent: ${text1}`);

    _webhookActive = true;

    console.log("\n  Sleeping for 5 seconds. A pipeline failure will be simulated in the background...");
    await new Promise((r) => setTimeout(r, 5000));

    const prompt2 = "I'm back. Any updates on my builds?";
    console.log(`\n  User: ${prompt2}`);
    const response2 = await my_agent.chat(prompt2);
    const text2 = await response2.text();
    console.log(`  Agent: ${text2}`);

    console.log("\n  Ending session. Background triggers will stop automatically.");
  });
}

async function main() {
  await runPeriodicTriggerExample();
  console.log("\n" + "=".repeat(60) + "\n");
  await runCustomTriggerExample();
}

main().catch(console.error);
