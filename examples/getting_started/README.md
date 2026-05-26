# Getting Started with Google Antigravity SDK

This directory contains minimal, single-file examples demonstrating the core features of the Google Antigravity SDK in Node.js / TypeScript.

## 🚀 Quickstart

To get started immediately, install the SDK dependencies, set your API key, and run the basic chat snippet.

### 1. Authenticate

```bash
export GEMINI_API_KEY="your_api_key_here"
```
*(Note: Alternatively, you can pass your key explicitly in code via `new LocalAgentConfig({ api_key: "..." })`).*

### 2. Execute Your First Turn

Create a file named `quickstart.ts` and run it using `pnpm ts-node quickstart.ts`:

```typescript
import { Agent, LocalAgentConfig } from "google-antigravity";

async function main() {
  // Initialize the agent configuration. It automatically picks up GEMINI_API_KEY from the environment.
  const config = new LocalAgentConfig({ model: "gemini-3.5-flash" });
  await Agent.run(config, async (agent) => {
    const response = await agent.chat("Explain quantum computing in one sentence.");
    console.log(await response.text());
  });
}

main().catch(console.error);
```

---

## 🗂️ Examples Index

Once you have the quickstart running, explore the modular examples below to understand the SDK's capabilities. Run any example directly from your terminal (e.g., `pnpm ts-node examples/getting_started/hello_world.ts`).

### Core Foundations
The essential building blocks for initializing, configuring, and prompting agents.
* [hello_world.ts](hello_world.ts): Initializing an agent, runner usage, and explicit model configuration.
* [streaming.ts](streaming.ts): Real-time token streaming and inspecting model reasoning via `response.thoughts()`.
* [persona_config.ts](persona_config.ts): Structuring system instructions and shaping agent identity using `TemplatedSystemInstructions`.

### 🛡️ Safety & Governance
Securing agent actions and keeping humans in control before executing external tools.
* [policies.ts](policies.ts): Implementing robust safety policies ("Deny by Default", allowlisting, and `askUser`).
* [human_in_the_loop.ts](human_in_the_loop.ts): Interactively pausing execution to request human confirmation or input.

### 🧩 Structured & Multimodal Interactivity
Handling complex inputs and enforcing strict data outputs.
* [multimodal.ts](multimodal.ts): Processing images/PDFs and generating visual assets.
* [structured_output.ts](structured_output.ts): Enforcing strictly typed JSON responses matching Pydantic/JSON schemas (`response_schema`).

### 🛠️ Tools, Skills, & Delegation
Extending agent capabilities and orchestrating multi-agent workflows.
* [custom_tools.ts](custom_tools.ts): Defining stateful TypeScript functions as tools using `ToolContext`.
* [agent_skills.ts](agent_skills.ts): Discovering and loading domain-specific skills from the filesystem (`SKILL.md`).
* [mcp_tools.ts](mcp_tools.ts): Connecting to external toolsets via the Model Context Protocol (MCP).
* [subagents.ts](subagents.ts): Spawning and delegating specialized tasks to sub-agents.

### ⚙️ Lifecycle, Proactivity, & Observability
Controlling execution flow, reacting to background events, auditing performance, and maintaining session state.
* [hooks.ts](hooks.ts): Intercepting session and turn lifecycle events (`pre_turn`, `post_turn`).
* [triggers.ts](triggers.ts): Running background checks and periodic tasks during active conversations.
* [observability.ts](observability.ts): Auditing execution, tracking token costs (including thinking tokens), and configuring logging.
* [error_handler.ts](error_handler.ts): Gracefully recovering from tool execution failures via `OnToolErrorHook`.
* [persistence.ts](persistence.ts): Saving and resuming stateful conversation sessions across restarts using `conversationId` and `save_dir`.
* [app_data_dir_override.ts](app_data_dir_override.ts): Overriding the default application data directory for agent artifacts, scratch files, and media storage using `app_data_dir`.
