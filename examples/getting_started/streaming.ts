import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";

async function main() {
  const config = new LocalAgentConfig({
    model: "gemini-3.5-flash"
  });

  console.log("Starting Agent session in streaming mode...");
  await Agent.run(config, async (agent) => {
    const response = await agent.chat("Write a short poem about antigravity.");

    console.log("\n--- Reasoning / Thoughts Stream ---");
    const thoughtsIterator = response.thoughts;
    while (true) {
      const res = await thoughtsIterator.next();
      if (res.done) break;
      process.stdout.write(res.value);
    }

    console.log("\n\n--- Conversational Output Stream ---");
    for await (const chunk of response) {
      process.stdout.write(chunk);
    }
    console.log("\n");
  });
}

main().catch(console.error);
