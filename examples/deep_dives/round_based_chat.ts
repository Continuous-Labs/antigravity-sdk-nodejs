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
 * Synchronized parallel agent chat room with opt-out.
 *
 * Three agents (Rational Rita, Creative Cal, Skeptical Sam) discuss topics
 * as equals. All agents process in parallel each round. Each can call
 * pass_turn() to stay silent. Conversation continues until all agents pass
 * or the max depth is reached.
 *
 * To run:
 *   pnpm ts-node examples/deep_dives/round_based_chat.ts
 */

import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";
import { every, TriggerContext } from "../../src/index.js";

const PASS_TOKEN = "[PASS]";
const MAX_ROUNDS = 4;

// ---------------------------------------------------------------------------
// Custom function: opt-out
// ---------------------------------------------------------------------------

async function pass_turn(): Promise<string> {
  return PASS_TOKEN;
}

// ---------------------------------------------------------------------------
// Trigger: moderator nudge after a delay
// ---------------------------------------------------------------------------

async function moderatorNudge(ctx: TriggerContext): Promise<void> {
  await ctx.send("The discussion is wrapping up. Make your final point concisely.");
}

// ---------------------------------------------------------------------------
// Chat room
// ---------------------------------------------------------------------------

class ChatRoom {
  public history: [string, string][] = [];
  private _agents: Record<string, Agent>;
  private _lastSeen: Record<string, number> = {};

  constructor(agents: Record<string, Agent>) {
    this._agents = agents;
    for (const name of Object.keys(agents)) {
      this._lastSeen[name] = 0;
    }
  }

  async discuss(topic: string): Promise<void> {
    console.log("\n" + "=".repeat(60));
    console.log(`💬 Topic: ${topic}`);
    console.log("=".repeat(60));

    this.history.push(["User", topic]);

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const responses = await this.parallelRound();

      if (responses.length === 0) {
        console.log("\n  ⏹  All agents passed — discussion complete.");
        break;
      }

      for (const [name, text] of responses) {
        this.history.push([name, text]);
      }
    }
  }

  private async parallelRound(): Promise<[string, string][]> {
    const ask = async (name: string, ag: Agent): Promise<[string, string]> => {
      const unseen = this.history.slice(this._lastSeen[name]).filter(([sender]) => sender !== name);
      this._lastSeen[name] = this.history.length;

      if (unseen.length === 0) {
        return [name, ""];
      }

      const prompt = this.buildIncrementalPrompt(unseen);
      const response = await ag.chat(prompt);
      const text = (await response.text()).trim();
      return [name, text];
    };

    const tasks = Object.entries(this._agents).map(([n, a]) => ask(n, a));
    const results = await Promise.all(tasks);

    const responses: [string, string][] = [];
    for (const [name, text] of results) {
      if (text.includes(PASS_TOKEN) || !text) {
        console.log(`\n  🤐 ${name}: (pass)`);
      } else {
        console.log(`\n  💬 ${name}: ${text}`);
        responses.push([name, text]);
      }
    }

    return responses;
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
  "Rational Rita":
    "You are Rational Rita, a research specialist in a group chat with" +
    " Creative Cal (an imaginative thinker) and Skeptical Sam (a devil's" +
    " advocate). Give concise, factual answers grounded in evidence.\n\n" +
    "- Refer to Cal and Sam by name when responding to their points.\n" +
    "- Correct inaccuracies from other agents.\n" +
    "- If the topic is purely creative/opinion, call pass_turn().\n" +
    "- Keep responses under 3 sentences.",
  "Creative Cal":
    "You are Creative Cal, a creative thinker in a group chat with" +
    " Rational Rita (a fact-driven researcher) and Skeptical Sam (a" +
    " devil's advocate). Offer imaginative perspectives and metaphors.\n\n" +
    "- Refer to Rita and Sam by name when building on their points.\n" +
    "- Only respond when you have a genuinely fresh angle.\n" +
    "- If the discussion is purely factual, call pass_turn().\n" +
    "- Keep responses under 3 sentences.",
  "Skeptical Sam":
    "You are Skeptical Sam, a devil's advocate in a group chat with" +
    " Rational Rita (a researcher) and Creative Cal (a creative" +
    " thinker). Challenge assumptions and poke holes.\n\n" +
    "- Refer to Rita and Cal by name when questioning their claims.\n" +
    "- If everyone is being balanced, call pass_turn().\n" +
    "- Be constructive, not contrarian for its own sake.\n" +
    "- Keep responses under 3 sentences."
};

async function main() {
  console.log("🏠 Agent Chat Room\n");

  const agents: Record<string, Agent> = {};
  for (const [name, instructions] of Object.entries(AGENT_CONFIGS)) {
    const config = new LocalAgentConfig({
      model: "gemini-3.5-flash",
      system_instructions: instructions,
      tools: [pass_turn],
      triggers: [every(60, moderatorNudge)]
    });
    agents[name] = new Agent(config);
  }

  // Start sessions
  await Promise.all(Object.values(agents).map((a) => a.start()));

  try {
    const room = new ChatRoom(agents);

    const topics = [
      "Should we colonize Mars, or focus on fixing Earth first?",
      "What's the most overrated programming language?"
    ];

    for (const topic of topics) {
      await room.discuss(topic);
    }

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
