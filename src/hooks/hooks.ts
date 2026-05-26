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
  Content,
  ToolCall,
  ToolResult,
  HookResult,
  QuestionHookResult,
  AskQuestionInteractionSpec
} from "../types.js";

export { HookResult };

export class HookContext {
  parent: HookContext | null;
  private _store = new Map<string, any>();

  constructor(parent: HookContext | null = null) {
    this.parent = parent;
  }

  get(key: string, defaultValue: any = null): any {
    if (this._store.has(key)) {
      return this._store.get(key);
    }
    if (this.parent) {
      return this.parent.get(key, defaultValue);
    }
    return defaultValue;
  }

  set(key: string, value: any): void {
    this._store.set(key, value);
  }
}

export class SessionContext extends HookContext {
  constructor() {
    super(null);
  }
}

export class TurnContext extends HookContext {
  constructor(sessionContext: SessionContext) {
    super(sessionContext);
  }
}

export class OperationContext extends HookContext {
  constructor(turnContext: TurnContext) {
    super(turnContext);
  }
}

export interface Hook<T, R = void> {
  run(context: HookContext, data: T): R | Promise<R>;
}

export interface OnSessionStartHook extends Hook<void, void> {}
export interface OnSessionEndHook extends Hook<void, void> {}
export interface PreTurnHook extends Hook<Content, HookResult> {}
export interface PostTurnHook extends Hook<string, void> {}
export interface PreToolCallDecideHook extends Hook<ToolCall, HookResult> {}
export interface PostToolCallHook extends Hook<ToolResult, void> {}
export interface OnToolErrorHook extends Hook<Error, any> {}
export interface OnInteractionHook extends Hook<AskQuestionInteractionSpec, QuestionHookResult> {}
export interface OnCompactionHook extends Hook<void, void> {}
