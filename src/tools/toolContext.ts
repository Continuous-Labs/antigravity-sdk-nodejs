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

import { Connection } from "../connections/connection.js";

export class ToolContext {
  private _connection: Connection;
  private _state: Record<string, any> = {};

  constructor(conn: Connection) {
    this._connection = conn;
  }

  get connection(): Connection {
    return this._connection;
  }

  get conversationId(): string {
    return this._connection.conversationId;
  }

  get conversation_id(): string {
    return this.conversationId;
  }

  get isIdle(): boolean {
    return this._connection.isIdle;
  }

  get is_idle(): boolean {
    return this.isIdle;
  }

  async send(message: string): Promise<void> {
    await this._connection.sendTriggerNotification(message);
  }

  getState<T = any>(key: string, defaultValue?: T): T | undefined {
    return this._state[key] !== undefined ? this._state[key] : defaultValue;
  }

  get_state<T = any>(key: string, defaultValue?: T): T | undefined {
    return this.getState(key, defaultValue);
  }

  setState(key: string, value: any): void {
    this._state[key] = value;
  }

  set_state(key: string, value: any): void {
    this.setState(key, value);
  }
}
