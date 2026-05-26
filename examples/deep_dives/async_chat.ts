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
 * Fully async peer-to-peer agent chat — no rounds.
 *
 * Contrast with round_based_chat.ts which uses synchronized parallel
 * rounds. Here, each agent runs its own independent loop and reacts
 * whenever any peer posts a new message. Ordering is emergent — whoever
 * finishes agent.chat() first gets the next word.
 *
 * To run:
 *   pnpm ts-node examples/deep_dives/async_chat.ts
 */

import { EventEmitter } from "events";
import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";

const PASS_TOKEN = "[PASS]";
const MAX_CONSECUTIVE_PASSES = 2; // agent exits after N passes in a row
const DISCUSSION_TIMEOUT = 120; // seconds

// ---------------------------------------------------------------------------
// Custom function: opt-out
// ---------------------------------------------------------------------------

async function pass_turn(): Promise<string> {
  return PASS_TOKEN;
}

// ---------------------------------------------------------------------------
// Condition helper mimicking asyncio.Condition
// ---------------------------------------------------------------------------

class Condition {
  private _emitter = new EventEmitter();

  notifyAll() {
    this._emitter.emit("signal");
  }

  async waitFor(predicate: () => boolean): Promise<void> {
    while (!predicate()) {
      await new Promise((resolve) => this._emitter.once("signal", resolve));
    }
  }
}

// ---------------------------------------------------------------------------
// Async chat room — no rounds, fully reactive
// ---------------------------------------------------------------------------

class AsyncChatRoom {
  public history: [string, string][] = [];
  private _agents: Record<string, Agent>;
  private _cond = new Condition();
  private _done = false;

  constructor(agents: Record<string, Agent>) {
    this._agents = agents;
  }

  async discuss(topic: string): Promise<void> {
    console.log("\n" + "=".repeat(60));
    console.log(`💬 Topic: ${topic}`);
    console.log("=".repeat(60));

    this.history.push(["User", topic]);

    const promises = Object.entries(this._agents).map(([name, agent]) =>
      this.agentLoop(name, agent)
    );

    // Discussion timeout promise
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        if (!this._done) {
          console.log(`\n  ⏹  Timeout after ${DISCUSSION_TIMEOUT}s.`);
          this._done = true;
          this._cond.notifyAll();
        }
        resolve();
      }, DISCUSSION_TIMEOUT * 1000);
    });

    await Promise.race([Promise.all(promises), timeoutPromise]);
    this._done = true;
    this._cond.notifyAll();
    console.log("\n  ⏹  Discussion concluded.");
  }

  private async agentLoop(name: string, agent: Agent): Promise<void> {
    let lastSeen = 0;
    let consecutivePasses = 0;

    while (!this._done) {
      // Wait for new history
      await this._cond.waitFor(() => this.history.length > lastSeen || this._done);
      if (this._done) {
        break;
      }

      const newMessages = this.history.slice(lastSeen);
      lastSeen = this.history.length;

      // Filter messages not seen yet
      const unseen = newMessages.filter(
        ([sender, text]) => sender !== name && !text.includes(PASS_TOKEN) && text
      );

      if (unseen.length === 0) {
        continue;
      }

      const prompt = this.buildIncrementalPrompt(unseen);
      const response = await agent.chat(prompt);
      const text = (await response.text()).trim();
      const isPass = text.includes(PASS_TOKEN) || !text;

      if (isPass) {
        consecutivePasses += 1;
        console.log(`\n  🤐 ${name}: (pass)`);
      } else {
        consecutivePasses = 0;
        console.log(`\n  💬 ${name}: ${text}`);
      }

      this.history.push([name, text]);
      lastSeen = this.history.length;
      this._cond.notifyAll();

      if (consecutivePasses >= MAX_CONSECUTIVE_PASSES) {
        console.log(`\n  ✋ ${name}: leaving discussion.`);
        break;
      }
    }
  }

  private buildIncrementalPrompt(unseen: [string, string][]): string {
    const lines = unseen.map(([sender, text]) => `[${sender}]: ${text}`);
    return (
      "New messages from other agents:\n\n" +
      lines.join("\n\n") +
      "\n\nRespond to the latest messages. Address other agents by" +
      " name when you agree, disagree, or build on their points." +
      " Keep it under 3 sentences." +
      " If you have nothing to add, call pass_turn()."
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const AGENT_CONFIGS: Record<string, string> = {
  "Pragmatic Priya":
    "You are Pragmatic Priya, a senior engineer in a group chat with" +
    " Visionary Vince (a futurist thinker) and Cautious Cora (a risk" +
    " analyst). Focus on what's technically feasible today.\n\n" +
    "- Refer to Vince and Cora by name when responding to their points.\n" +
    "- Ground speculative ideas in current engineering constraints.\n" +
    "- If the topic is purely theoretical, call pass_turn().\n" +
    "- Keep responses under 3 sentences.",
  "Visionary Vince":
    "You are Visionary Vince, a futurist thinker in a group chat with" +
    " Pragmatic Priya (a senior engineer) and Cautious Cora (a risk" +
    " analyst). Paint bold pictures of what's possible in 10-20 years.\n\n" +
    "- Refer to Priya and Cora by name when building on their points.\n" +
    "- Only respond when you have a genuinely forward-looking angle.\n" +
    "- If the discussion is purely about present-day details, call" +
    " pass_turn().\n" +
    "- Keep responses under 3 sentences.",
  "Cautious Cora":
    "You are Cautious Cora, a risk analyst in a group chat with" +
    " Pragmatic Priya (an engineer) and Visionary Vince (a futurist)." +
    " Identify what could go wrong.\n\n" +
    "- Refer to Priya and Vince by name when questioning their claims.\n" +
    "- If everyone is being sufficiently cautious, call pass_turn().\n" +
    "- Be constructive — flag risks with mitigations, not just doom.\n" +
    "- Keep responses under 3 sentences."
};

async function main() {
  console.log("🏠 Async Agent Chat (no rounds)\n");

  const agents: Record<string, Agent> = {};
  for (const [name, instructions] of Object.entries(AGENT_CONFIGS)) {
    const config = new LocalAgentConfig({
      model: "gemini-3.5-flash",
      system_instructions: instructions,
      tools: [pass_turn]
    });
    agents[name] = new Agent(config);
  }

  // Start sessions
  await Promise.all(Object.values(agents).map((a) => a.start()));

  try {
    const room = new AsyncChatRoom(agents);
    await room.discuss(
      "Should AI agents be allowed to autonomously deploy code to production?"
    );

    // Print conversation history.
    console.log("\n" + "=".repeat(60));
    console.log(`📋 Transcript (${room.history.length} turns)`);
    console.log("=".repeat(60));
    room.history.forEach(([name, text], i) => {
      console.log(`  ${i + 1}. [${name}]: ${text}`);
    });
  } finally {
    // Stop sessions
    await Promise.all(Object.values(agents).map((a) => a.stop()));
  }
}

main().catch(console.error);
