import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";

async function main() {
  const config = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    api_key: process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY"
  });

  console.log("Starting Antigravity Agent session...");
  await Agent.run(config, async (agent) => {
    console.log("Sending prompt: 'Hello! Who are you?'");
    const response = await agent.chat("Hello! Who are you?");
    const text = await response.text();
    console.log("Response from Agent:", text);
  });
}

main().catch(console.error);
