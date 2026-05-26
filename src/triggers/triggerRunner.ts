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

import { Trigger } from "./triggers.js";
import { Connection } from "../connections/connection.js";

export class TriggerRunner {
  private _triggers: Trigger[];
  private _connection: Connection;

  constructor(triggers: Trigger[], connection: Connection) {
    this._triggers = triggers;
    this._connection = connection;
  }

  start(): void {
    for (const trigger of this._triggers) {
      trigger.start((content) => {
        this._connection.sendTriggerNotification(content).catch((err) => {
          console.error("Failed to deliver trigger notification:", err);
        });
      });
    }
  }

  stop(): void {
    for (const trigger of this._triggers) {
      trigger.stop();
    }
  }
}
