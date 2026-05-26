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
 * Public exports for Google Antigravity SDK.
 */

export { Agent } from "./agent.js";
export { AgentConfig, Connection, ConnectionStrategy } from "./connections/connection.js";
export { LocalAgentConfig } from "./connections/local/localConnectionConfig.js";
export { LocalConnection, LocalConnectionStrategy } from "./connections/local/localConnection.js";
export { ToolContext } from "./tools/toolContext.js";
export { ToolRunner } from "./tools/toolRunner.js";
export { Trigger, IntervalTrigger, every, trigger, TriggerContext, TriggerCallback } from "./triggers/triggers.js";
export { TriggerRunner } from "./triggers/triggerRunner.js";
export * from "./hooks/hooks.js";
export { HookRunner } from "./hooks/hookRunner.js";
export * as policy from "./hooks/policy.js";
export * as interactive from "./utils/interactive.js";
export * from "./types.js";
export { encodeInputConfig, decodeOutputConfig } from "./connections/local/protobuf.js";
