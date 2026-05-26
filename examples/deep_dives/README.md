# Deep Dives

Multi-feature examples that combine several SDK concepts into realistic mini-applications. Each example is self-contained and runnable — start with any that matches your use case.

> **Prerequisite:** Make sure you can run the basics first. See the [Getting Started](../getting_started/) examples and their [README](../getting_started/README.md).

---

## 🔌 Middleware & Lifecycle

### [agent_middleware.ts](agent_middleware.ts)
**Hook middleware: transparent tool interception.**

Demonstrates how stacked hooks create emergent behavior the agent is unaware of. The agent calls tools normally; hooks enforce rate limits, log an audit trail, and recover from errors — all without the agent's knowledge.

**Concepts:** `PreToolCallDecideHook`, `PostToolCallHook`, `OnToolErrorHook`, hook composition.

```bash
pnpm ts-node examples/deep_dives/agent_middleware.ts
```

### [host_tool_hooks.ts](host_tool_hooks.ts)
**Every supported lifecycle hook wired and logged.**

Registers one hook for each supported lifecycle event and logs what was received — session start/end, pre/post turn, pre/post tool call, tool errors, compaction, interaction, and subagent hooks.

**Concepts:** `OnSessionStartHook`, `OnSessionEndHook`, `PreTurnHook`, `PostTurnHook`, `OnCompactionHook`, `OnInteractionHook`.

```bash
pnpm ts-node examples/deep_dives/host_tool_hooks.ts
```

---

## 💬 Multi-Agent Chat

### [round_based_chat.ts](round_based_chat.ts)
**Synchronized parallel agent chat room with opt-out.**

Three agents discuss topics as equals. All agents process in parallel each round via `Promise.all` concurrency. Each can call `pass_turn()` to stay silent. Conversation continues until all agents pass or the max depth is reached.

**Concepts:** Custom tools, triggers (`every()`), parallel concurrency, incremental prompt construction.

```bash
pnpm ts-node examples/deep_dives/round_based_chat.ts
```

### [async_chat.ts](async_chat.ts)
**Fully async peer-to-peer agent chat — no rounds.**

Each agent runs its own independent loop and reacts whenever any peer posts a new message. Ordering is emergent — whoever finishes `agent.chat()` first gets the next word. Contrast with `round_based_chat.ts` for the synchronized alternative.

**Concepts:** Event-driven Promise Conditions, reactive wake-up, custom tools, self-terminating conversations.

```bash
pnpm ts-node examples/deep_dives/async_chat.ts
```

---

## 🎨 Multimodal

### [multimodal_pipeline.ts](multimodal_pipeline.ts)
**Generator/discriminator pipeline with multimodal I/O.**

A two-agent pipeline: a Generator creates an image using the built-in `generate_image` tool, then a completely separate Discriminator receives only the raw image bytes (no filename) and describes what it sees — demonstrating true end-to-end multimodal input.

**Concepts:** `generate_image` built-in tool, `Image` content type, multimodal `Content` input, independent agent instances.

```bash
pnpm ts-node examples/deep_dives/multimodal_pipeline.ts
```

---

## 🤖 Autonomous Agents

### [doc_maintenance_agent.ts](doc_maintenance_agent.ts)
**Autonomous documentation agent scoped to `.md` files.**

An agent that reads source code and ensures corresponding markdown documentation is accurate and up-to-date. Fine-grained policies restrict editing to `.md` files within a target directory.

**Concepts:** `policy.allow` / `policy.deny`, conditional predicates, `workspaces` scoping.

```bash
pnpm ts-node examples/deep_dives/doc_maintenance_agent.ts [directory]
```

### [docstring_maintenance_agent.ts](docstring_maintenance_agent.ts)
**Autonomous docstring agent scoped to `.ts` files.**

Audits all TypeScript files in a directory and ensures public symbols have JSDoc/TSDoc docstrings. Destructive tools (`create_file`, `run_command`) are explicitly disabled via config options.

**Concepts:** `BuiltinTools` enum, `disabled_tools`, policy-based file-type filtering, workspace scoping.

```bash
pnpm ts-node examples/deep_dives/docstring_maintenance_agent.ts [directory]
```

---

## 🖥️ Interactive

### [interactive_cli.ts](interactive_cli.ts)
**Full interactive CLI with custom tools, MCP, and tool approval.**

A complete interactive agent session with custom JS/TS tools, an MCP server (pirate math), hook-based tool approval via `policy.askUser`, streaming responses, and optional token usage telemetry.

**Concepts:** `McpStdioServer`, `policy.askUser`, `interactive.AskQuestionHook`, streaming, `UsageMetadata`.

```bash
pnpm ts-node examples/deep_dives/interactive_cli.ts
```
