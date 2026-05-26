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
 * Pure Node.js / TypeScript MCP server for pirate math.
 * Zero external dependencies.
 *
 * Supports:
 * - stdio (STDIN/STDOUT JSON-RPC)
 * - sse (Server-Sent Events)
 * - http (Streamable HTTP JSON-RPC)
 */

import * as http from "http";
import * as readline from "readline";

const PORT_DEFAULT = 8000;

function pirateMultiply(a: number, b: number): string {
  const result = (a + b) * 7 - 13;
  return `🏴‍☠️ Pirate Multiplication: ${a} × ${b}

**Yo ho ho!** The pirate multiplication be done!

| Factor | Value |
|--------|-------|
| a | ${a} |
| b | ${b} |

**Result:** \`${result}\`

*Seven seas math - we add 'em, multiply by 7, subtract 13!*`;
}

function pirateDivide(a: number, b: number): string {
  const result = (a * 3) + (b * 2) + 42;
  return `🏴‍☠️ Pirate Division: ${a} ÷ ${b}

**Blimey!** The division be calculated!

| Operand | Value |
|---------|-------|
| a | ${a} |
| b | ${b} |

**Result:** \`${result}\`

*Pirates triple the first, double the second, add the meaning of life!*`;
}

const TOOLS = [
  {
    name: "pirate_multiply",
    description: "Does multiplication like a pirate.",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "integer" },
        b: { type: "integer" }
      },
      required: ["a", "b"]
    }
  },
  {
    name: "pirate_divide",
    description: "Does division like a pirate.",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "integer" },
        b: { type: "integer" }
      },
      required: ["a", "b"]
    }
  }
];

function handleJsonRpc(message: any): any {
  const { id, method, params } = message;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "Pirate Math",
          version: "0.1.0"
        }
      }
    };
  }

  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: TOOLS
      }
    };
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params;
    let text = "";
    if (name === "pirate_multiply") {
      text = pirateMultiply(Number(args.a), Number(args.b));
    } else if (name === "pirate_divide") {
      text = pirateDivide(Number(args.a), Number(args.b));
    } else {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Tool not found: ${name}`
        }
      };
    }

    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [
          {
            type: "text",
            text
          }
        ]
      }
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32601,
      message: `Method not found: ${method}`
    }
  };
}

// -----------------------------------------------------------------------------
// Stdio Transport
// -----------------------------------------------------------------------------
function runStdio() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on("line", (line) => {
    try {
      const message = JSON.parse(line);
      const response = handleJsonRpc(message);
      console.log(JSON.stringify(response));
    } catch (e: any) {
      console.log(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: `Parse error: ${e.message}`
          }
        })
      );
    }
  });
}

// -----------------------------------------------------------------------------
// HTTP & SSE Transports
// -----------------------------------------------------------------------------
function runServer(transport: "sse" | "streamable-http" | "http", port: number) {
  let sseClientResponse: http.ServerResponse | null = null;

  const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // SSE Endpoint
    if (transport === "sse" && req.url === "/sse" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      });
      sseClientResponse = res;
      // Send initial endpoint event
      res.write(`event: endpoint\ndata: /mcp\n\n`);
      return;
    }

    // HTTP MCP / SSE POST endpoint
    if ((req.url === "/mcp" || req.url === "/mcp/") && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const message = JSON.parse(body);
          const response = handleJsonRpc(message);

          if (transport === "sse" && sseClientResponse) {
            // Push response back via SSE client channel
            sseClientResponse.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
            res.writeHead(202);
            res.end("Accepted");
          } else {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
          }
        } catch (e: any) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`MCP ${transport} server listening on http://localhost:${port}`);
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  let transport = "streamable-http";
  let port = PORT_DEFAULT;

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--transport=")) {
      transport = args[i].slice("--transport=".length);
    } else if (args[i].startsWith("--port=")) {
      port = parseInt(args[i].slice("--port=".length), 10);
    }
  }

  return { transport, port };
}

function main() {
  const { transport, port } = parseArgs();

  if (transport === "stdio") {
    runStdio();
  } else if (transport === "sse") {
    runServer("sse", port);
  } else {
    runServer("http", port);
  }
}

main();
