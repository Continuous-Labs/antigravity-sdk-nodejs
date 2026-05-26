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

import { describe, it, expect } from "vitest";
import {
  allow,
  deny,
  askUser,
  denyAll,
  allowAll,
  workspaceOnly,
  isPathInWorkspace,
  enforce
} from "./policy.js";
import { HookContext } from "./hooks.js";
import { ToolCall } from "../types.js";

describe("Safety Policies and Scopes Tests", () => {
  const dummyContext = new HookContext();

  it("should enforce denyAll policies by default", async () => {
    const policies = [denyAll()];
    const hook = enforce(policies);

    const call: ToolCall = { name: "run_command", args: { command_line: "ls" } };
    const res = await hook.run(dummyContext, call);

    expect(res.allow).toBe(false);
    expect(res.message).toContain("Denied by policy");
  });

  it("should permit specific tools when allowed", async () => {
    const policies = [denyAll(), allow("view_file")];
    const hook = enforce(policies);

    const call1: ToolCall = { name: "view_file", args: { path: "a.txt" } };
    const res1 = await hook.run(dummyContext, call1);
    expect(res1.allow).toBe(true);

    const call2: ToolCall = { name: "run_command", args: { command_line: "ls" } };
    const res2 = await hook.run(dummyContext, call2);
    expect(res2.allow).toBe(false);
  });

  it("should process custom conditional predicates correctly", async () => {
    const isDangerousCommand = (args: Record<string, any>) => {
      return args.command_line.includes("rm");
    };

    const policies = [
      denyAll(),
      allow("run_command"),
      deny("run_command", { when: isDangerousCommand, name: "block-rm" })
    ];
    const hook = enforce(policies);

    const safeCall: ToolCall = { name: "run_command", args: { command_line: "echo 123" } };
    const resSafe = await hook.run(dummyContext, safeCall);
    expect(resSafe.allow).toBe(true);

    const dangerousCall: ToolCall = { name: "run_command", args: { command_line: "rm -rf /" } };
    const resDangerous = await hook.run(dummyContext, dangerousCall);
    expect(resDangerous.allow).toBe(false);
    expect(resDangerous.message).toContain("block-rm");
  });

  it("should handle askUser approval loops", async () => {
    let mockUserResponse = false;
    const approvalHandler = async (tc: ToolCall) => {
      return mockUserResponse;
    };

    const policies = [
      denyAll(),
      askUser("create_file", { handler: approvalHandler, name: "ask-user-create" })
    ];
    const hook = enforce(policies);

    const call: ToolCall = { name: "create_file", args: { path: "test.md" } };

    // Deny case
    mockUserResponse = false;
    const res1 = await hook.run(dummyContext, call);
    expect(res1.allow).toBe(false);
    expect(res1.message).toContain("User denied tool");

    // Approve case
    mockUserResponse = true;
    const res2 = await hook.run(dummyContext, call);
    expect(res2.allow).toBe(true);
  });

  it("should structurally verify target paths inside workspaces", () => {
    expect(isPathInWorkspace("/workspace/project/a.txt", "/workspace/project")).toBe(true);
    expect(isPathInWorkspace("/workspace/project/sub/b.txt", "/workspace/project")).toBe(true);
    expect(isPathInWorkspace("/workspace/project", "/workspace/project")).toBe(true);
    expect(isPathInWorkspace("/etc/passwd", "/workspace/project")).toBe(false);
    expect(isPathInWorkspace("/workspace/another", "/workspace/project")).toBe(false);
  });

  it("should enforce strict workspaceOnly policies on file tools", async () => {
    const workspaces = ["/workspace/project"];
    const policies = [...workspaceOnly(workspaces)];
    const hook = enforce(policies);

    const callOutside: ToolCall = {
      name: "create_file",
      args: { TargetFile: "/etc/passwd" }
    };
    const resOutside = await hook.run(dummyContext, callOutside);
    expect(resOutside.allow).toBe(false);

    const callInside: ToolCall = {
      name: "create_file",
      args: { TargetFile: "/workspace/project/a.txt" }
    };
    const resInside = await hook.run(dummyContext, callInside);
    expect(resInside.allow).toBe(true);
  });
});
