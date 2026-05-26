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

export abstract class Trigger {
  abstract start(callback: (content: string) => void): void;
  abstract stop(): void;
}

export class IntervalTrigger extends Trigger {
  private _intervalMs: number;
  private _content: string;
  private _timer: NodeJS.Timeout | null = null;

  constructor(intervalMs: number, content = "Interval trigger fired") {
    super();
    this._intervalMs = intervalMs;
    this._content = content;
  }

  start(callback: (content: string) => void): void {
    if (this._timer) return;
    this._timer = setInterval(() => {
      callback(this._content);
    }, this._intervalMs);
  }

  stop(): void {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}

export interface TriggerContext {
  send(content: string): Promise<void>;
}

export type TriggerCallback = (ctx: TriggerContext) => void | Promise<void>;

export class CustomTrigger extends Trigger {
  private _runner: TriggerCallback;
  private _callback: ((content: string) => void) | null = null;
  private _stopped = false;

  constructor(runner: TriggerCallback) {
    super();
    this._runner = runner;
  }

  start(callback: (content: string) => void): void {
    this._callback = callback;
    this._stopped = false;
    const ctx: TriggerContext = {
      send: async (content: string) => {
        if (!this._stopped && this._callback) {
          this._callback(content);
        }
      }
    };
    (async () => {
      try {
        await this._runner(ctx);
      } catch (err) {
        console.error("Error in background trigger:", err);
      }
    })();
  }

  stop(): void {
    this._stopped = true;
    this._callback = null;
  }

  get isStopped(): boolean {
    return this._stopped;
  }
}

export function every(seconds: number, callback: TriggerCallback): Trigger {
  let timer: NodeJS.Timeout | null = null;
  const triggerInstance = new CustomTrigger(async (ctx) => {
    timer = setInterval(async () => {
      if (triggerInstance.isStopped) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
        return;
      }
      try {
        await callback(ctx);
      } catch (err) {
        console.error("Error in 'every' callback:", err);
      }
    }, seconds * 1000);
  });

  const originalStop = triggerInstance.stop.bind(triggerInstance);
  triggerInstance.stop = () => {
    originalStop();
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  return triggerInstance;
}

export function trigger(runner: TriggerCallback): Trigger {
  return new CustomTrigger(runner);
}
