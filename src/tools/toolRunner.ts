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

import { ToolCall, ToolResult } from "../types.js";

export class ToolRunner {
  private _tools = new Map<string, Function>();
  private _context: any = null;

  constructor(tools: Function[] = []) {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  registerTool(tool: Function) {
    const name = tool.name;
    if (!name) {
      throw new Error("Tool function must have a name");
    }
    this._tools.set(name, tool);
  }

  setContext(ctx: any) {
    this._context = ctx;
  }

  async processToolCalls(calls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    for (const call of calls) {
      const fn = this._tools.get(call.name);
      if (!fn) {
        results.push({
          name: call.name,
          id: call.id,
          error: `Tool '${call.name}' not found.`
        });
        continue;
      }
      try {
        // Execute tool. We pass the args dictionary as the first parameter.
        const res = await fn(call.args, this._context);
        results.push({
          name: call.name,
          id: call.id,
          result: res
        });
      } catch (err: any) {
        results.push({
          name: call.name,
          id: call.id,
          error: err.message || String(err),
          exception: err
        });
      }
    }
    return results;
  }
}
