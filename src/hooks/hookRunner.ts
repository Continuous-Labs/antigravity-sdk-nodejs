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

import {
  Hook,
  SessionContext,
  TurnContext,
  OperationContext,
  PreTurnHook,
  PreToolCallDecideHook,
  PostToolCallHook,
  OnToolErrorHook
} from "./hooks.js";
import {
  ToolCall,
  ToolResult
} from "../types.js";

export class HookRunner {
  private _sessionContext = new SessionContext();
  private _preTurnHooks: PreTurnHook[] = [];
  private _preToolCallDecideHooks: PreToolCallDecideHook[] = [];
  private _postToolCallHooks: PostToolCallHook[] = [];
  private _onToolErrorHooks: OnToolErrorHook[] = [];

  get sessionContext(): SessionContext {
    return this._sessionContext;
  }

  registerHook(hook: Hook<any, any>) {
    // Dynamically registers hooks based on structure/duck typing or explicit markers.
    // For Node.js SDK, we can check property existence or allow explicit registrations.
    // Let's implement safe manual checks:
    if ("run" in hook) {
      if (this._isPreToolCallDecideHook(hook)) {
        this._preToolCallDecideHooks.push(hook as PreToolCallDecideHook);
      } else if (this._isPreTurnHook(hook)) {
        this._preTurnHooks.push(hook as PreTurnHook);
      } else if (this._isPostToolCallHook(hook)) {
        this._postToolCallHooks.push(hook as PostToolCallHook);
      } else if (this._isOnToolErrorHook(hook)) {
        this._onToolErrorHooks.push(hook as OnToolErrorHook);
      }
    }
  }

  private _isPreToolCallDecideHook(hook: any): boolean {
    return hook.constructor.name.includes("PreToolCall") || hook.constructor.name.includes("Policy");
  }

  private _isPreTurnHook(hook: any): boolean {
    return hook.constructor.name.includes("PreTurn");
  }

  private _isPostToolCallHook(hook: any): boolean {
    return hook.constructor.name.includes("PostToolCall");
  }

  private _isOnToolErrorHook(hook: any): boolean {
    return hook.constructor.name.includes("OnToolError");
  }

  async dispatchPreToolCall(turnContext: TurnContext, toolCall: ToolCall): Promise<{ allow: boolean; message?: string }> {
    const opCtx = new OperationContext(turnContext);
    for (const hook of this._preToolCallDecideHooks) {
      const res = await hook.run(opCtx, toolCall);
      if (!res.allow) {
        return { allow: false, message: res.message || "Denied by policy." };
      }
    }
    return { allow: true };
  }

  async dispatchPostToolCall(opCtx: OperationContext, result: ToolResult): Promise<void> {
    for (const hook of this._postToolCallHooks) {
      await hook.run(opCtx, result);
    }
  }

  async dispatchOnToolError(opCtx: OperationContext, err: Error): Promise<{ allow: boolean; recoveryVal?: any }> {
    for (const hook of this._onToolErrorHooks) {
      const recoveryVal = await hook.run(opCtx, err);
      if (recoveryVal !== undefined) {
        return { allow: true, recoveryVal };
      }
    }
    return { allow: false };
  }
}
