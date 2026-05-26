# Google Antigravity SDK — Examples

Runnable examples that demonstrate the Google Antigravity SDK in Node.js / TypeScript, organized from introductory snippets to more advanced patterns.

## Prerequisites

Ensure you have your environment configured and the dependencies installed:

```bash
# Export your Gemini API Key
export GEMINI_API_KEY="your_api_key_here"

# Install package dependencies using pnpm
pnpm install
```

To run any of the TypeScript examples directly from source without manual compilation, you can use `ts-node` or `tsx` (e.g. `pnpm ts-node examples/getting_started/hello_world.ts`).

## Directory Layout

### [`getting_started/`](getting_started/)

**Start here.** Bite-sized, single-file examples — one feature per file. Each runs standalone and covers a core SDK concept: agents, streaming, tools, policies, hooks, structured output, and more.

→ See the [Getting Started README](getting_started/README.md) for the full index and a quickstart snippet.

### [`deep_dives/`](deep_dives/)

Multi-feature examples that combine several SDK concepts into realistic mini-applications:

| Example | What it demonstrates |
|---|---|
| [interactive_cli.ts](deep_dives/interactive_cli.ts) | Full interactive CLI with custom tools, MCP servers, and hook-based tool approval. |
| [agent_middleware.ts](deep_dives/agent_middleware.ts) | Stacked hooks as transparent middleware — rate limiting, audit logging, and error recovery. |
| [host_tool_hooks.ts](deep_dives/host_tool_hooks.ts) | Every supported lifecycle hook wired and logged (session, turn, tool, subagent, compaction, interaction). |
| [round_based_chat.ts](deep_dives/round_based_chat.ts) | Synchronized multi-agent chat room with parallel turns, triggers, and opt-out via custom tools. |
| [async_chat.ts](deep_dives/async_chat.ts) | Fully async peer-to-peer agent chat — no rounds, reactive wake-ups via event-driven Promise Conditions. |
| [multimodal_pipeline.ts](deep_dives/multimodal_pipeline.ts) | Generator/discriminator pipeline: image creation → blind visual analysis via multimodal `Content`. |
| [doc_maintenance_agent.ts](deep_dives/doc_maintenance_agent.ts) | Autonomous documentation writer agent scoped to `.md` files with fine-grained safety policies. |
| [docstring_maintenance_agent.ts](deep_dives/docstring_maintenance_agent.ts) | Autonomous JSDoc/TSDoc agent scoped to `.ts` files with disabled destructive tools. |

### [`resources/`](resources/)

Shared assets used by the examples (images, MCP server, sample files).
