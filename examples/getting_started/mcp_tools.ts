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
 * MCP Integration example for Google Antigravity SDK.
 *
 * This example demonstrates how to connect an agent to external MCP servers
 * using stdio, SSE, and Streamable HTTP transports.
 *
 * To run:
 *   pnpm ts-node examples/getting_started/mcp_tools.ts
 */

import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as net from "net";
import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";
import { McpServerConfig } from "../../src/index.js";

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function startMcpServer(transport: "sse" | "streamable-http", port: number): Promise<ChildProcess> {
  return new Promise((resolve) => {
    const serverPath = path.resolve("examples/resources/mcp_server.ts");
    const transportArg = transport === "streamable-http" ? "streamable-http" : "sse";
    const proc = spawn("npx", ["ts-node", serverPath, `--transport=${transportArg}`, `--port=${port}`]);

    // Give it a moment to boot up
    setTimeout(() => {
      resolve(proc);
    }, 1500);
  });
}

async function mcpStdio() {
  console.log("\n  --- Showcasing Stdio Transport ---");
  const serverPath = path.resolve("examples/resources/mcp_server.ts");

  const stdioServer: McpServerConfig = {
    type: "stdio",
    command: "npx",
    args: ["ts-node", serverPath, "--transport=stdio"]
  };

  const config = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    mcp_servers: [stdioServer]
  });

  await Agent.run(config, async (my_agent) => {
    const prompt = "Use the pirate_multiply tool to multiply 5 and 7.";
    console.log(`  User: ${prompt}`);
    const response = await my_agent.chat(prompt);
    const text = await response.text();
    console.log(`  Agent: ${text}`);
  });
}

async function mcpSse() {
  console.log("\n  --- Showcasing SSE Transport ---");
  const port = await getFreePort();
  const proc = await startMcpServer("sse", port);

  try {
    const sseServer: McpServerConfig = {
      type: "sse",
      url: `http://localhost:${port}/sse`
    };

    const config = new LocalAgentConfig({
      model: "gemini-3.5-flash",
      mcp_servers: [sseServer]
    });

    await Agent.run(config, async (my_agent) => {
      const prompt = "Use the pirate_multiply tool to multiply 5 and 7.";
      console.log(`  User: ${prompt}`);
      const response = await my_agent.chat(prompt);
      const text = await response.text();
      console.log(`  Agent: ${text}`);
    });
  } finally {
    proc.kill();
  }
}

async function mcpHttp() {
  console.log("\n  --- Showcasing Streamable HTTP Transport ---");
  const port = await getFreePort();
  const proc = await startMcpServer("streamable-http", port);

  try {
    const httpServer: McpServerConfig = {
      type: "http",
      url: `http://localhost:${port}/mcp`
    };

    const config = new LocalAgentConfig({
      model: "gemini-3.5-flash",
      mcp_servers: [httpServer]
    });

    await Agent.run(config, async (my_agent) => {
      const prompt = "Use the pirate_multiply tool to multiply 5 and 7.";
      console.log(`  User: ${prompt}`);
      const response = await my_agent.chat(prompt);
      const text = await response.text();
      console.log(`  Agent: ${text}`);
    });
  } finally {
    proc.kill();
  }
}

async function main() {
  await mcpStdio();
  await mcpSse();
  await mcpHttp();
}

main().catch(console.error);
