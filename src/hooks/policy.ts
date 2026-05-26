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

import * as path from "path";

import { ToolCall, HookResult, BuiltinTools, BuiltinToolsHelper } from "../types.js";
import { HookContext, PreToolCallDecideHook } from "./hooks.js";

export enum Decision {
  APPROVE = "APPROVE",
  DENY = "DENY",
  ASK_USER = "ASK_USER",
}

export type Predicate = (args: Record<string, any>) => boolean | Promise<boolean>;
export type AskUserHandler = (tc: ToolCall) => boolean | Promise<boolean>;

export interface Policy {
  tool: string;
  decision: Decision;
  when?: Predicate;
  ask_user?: AskUserHandler;
  name?: string;
}

const WILDCARD = "*";

export function allow(tool: string, options?: { when?: Predicate; name?: string }): Policy {
  return { tool, decision: Decision.APPROVE, when: options?.when, name: options?.name };
}

export function deny(tool: string, options?: { when?: Predicate; name?: string }): Policy {
  return { tool, decision: Decision.DENY, when: options?.when, name: options?.name };
}

export function askUser(tool: string, options: { handler: AskUserHandler; when?: Predicate; name?: string }): Policy {
  return { tool, decision: Decision.ASK_USER, when: options.when, ask_user: options.handler, name: options.name };
}

export function allowAll(): Policy {
  return allow(WILDCARD, { name: "allow_all" });
}

export function denyAll(): Policy {
  return deny(WILDCARD, { name: "deny_all" });
}

export function confirmRunCommand(handler?: AskUserHandler): Policy[] {
  if (handler) {
    return [
      askUser(BuiltinTools.RUN_COMMAND, { handler, name: "confirm_run_command" }),
      allow(WILDCARD, { name: "confirm_run_command" })
    ];
  }
  return [
    deny(BuiltinTools.RUN_COMMAND, { name: "confirm_run_command" }),
    allow(WILDCARD, { name: "confirm_run_command" })
  ];
}

export function isPathInWorkspace(targetPath: string, workspacePath: string): boolean {
  try {
    const resolvedTarget = path.resolve(targetPath);
    const resolvedWS = path.resolve(workspacePath);
    
    // Perform structural segment containment verification
    const targetParts = resolvedTarget.split(path.sep).filter(Boolean);
    const wsParts = resolvedWS.split(path.sep).filter(Boolean);

    if (targetParts.length < wsParts.length) return false;

    // Platform case sensitivity
    const isWindows = process.platform === "win32";
    for (let i = 0; i < wsParts.length; i++) {
      const a = targetParts[i];
      const b = wsParts[i];
      if (isWindows) {
        if (a.toLowerCase() !== b.toLowerCase()) return false;
      } else {
        if (a !== b) return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function workspaceOnly(workspaces: string[]): Policy[] {
  const fileTools = BuiltinToolsHelper.fileTools();

  const outsideWorkspace = (args: Record<string, any>): boolean => {
    const target = args.TargetFile || args.file_path || args.path || args.AbsolutePath || "";
    if (!target) return false;
    return !workspaces.some(ws => isPathInWorkspace(target, ws));
  };

  return fileTools.map(tool => deny(tool, { when: outsideWorkspace, name: "workspace_only" }));
}

// Priorities: specific deny (0), specific ask (1), specific allow (2), wildcard deny (3), wildcard ask (4), wildcard allow (5)
function getPriorityBucketIndex(p: Policy): number {
  const isWildcard = p.tool === WILDCARD;
  if (isWildcard) {
    switch (p.decision) {
      case Decision.DENY: return 3;
      case Decision.ASK_USER: return 4;
      case Decision.APPROVE: return 5;
    }
  } else {
    switch (p.decision) {
      case Decision.DENY: return 0;
      case Decision.ASK_USER: return 1;
      case Decision.APPROVE: return 2;
    }
  }
}

export class PolicyDecideHook implements PreToolCallDecideHook {
  private _buckets: Policy[][] = Array.from({ length: 6 }, () => []);

  constructor(policies: Policy[]) {
    for (const p of policies) {
      const idx = getPriorityBucketIndex(p);
      this._buckets[idx].push(p);
    }
  }

  async run(_context: HookContext, data: ToolCall): Promise<HookResult> {
    const tc = data;
    for (const bucket of this._buckets) {
      for (const p of bucket) {
        if (p.tool === WILDCARD || p.tool === tc.name) {
          const matched = p.when ? await p.when(tc.args) : true;
          if (matched) {
            if (p.decision === Decision.DENY) {
              return { allow: false, message: `Denied by policy '${p.name || p.tool}'.` };
            }
            if (p.decision === Decision.APPROVE) {
              return { allow: true };
            }
            if (p.decision === Decision.ASK_USER && p.ask_user) {
              const approved = await p.ask_user(tc);
              if (approved) return { allow: true };
              return { allow: false, message: `User denied tool '${tc.name}' (policy '${p.name || p.tool}').` };
            }
          }
        }
      }
    }
    return { allow: true };
  }
}

export function enforce(policies: Policy[]): PreToolCallDecideHook {
  return new PolicyDecideHook(policies);
}
