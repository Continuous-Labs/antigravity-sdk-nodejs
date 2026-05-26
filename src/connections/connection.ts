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
  Step,
  ToolResult,
  CapabilitiesConfig,
  McpServerConfig,
  BuiltinToolsHelper,
  SystemInstructions
} from "../types.js";

/**
 * Abstract configuration for an agent.
 */
export abstract class AgentConfig {
  system_instructions?: string | SystemInstructions | null = null;
  capabilities: CapabilitiesConfig = {
    enabled_tools: BuiltinToolsHelper.readOnly()
  };
  tools: Function[] = [];
  policies: any[] = [];
  hooks: any[] = [];
  triggers: any[] = [];
  mcp_servers: McpServerConfig[] = [];
  workspaces: string[] = [];
  conversation_id?: string | null = null;
  save_dir?: string | null = null;
  app_data_dir?: string | null = null;
  response_schema?: Record<string, any> | string | null = null;
  skills_paths: string[] = [];

  abstract createStrategy(toolRunner: any, hookRunner: any): ConnectionStrategy;
}

/**
 * A live session with an agent backend.
 */
export abstract class Connection {
  get isIdle(): boolean {
    return true;
  }

  get conversationId(): string {
    return "";
  }

  abstract send(prompt: Content | null, options?: Record<string, any>): Promise<void>;

  abstract receiveSteps(): AsyncIterable<Step>;

  abstract disconnect(): Promise<void>;

  abstract cancel(): Promise<void>;

  abstract delete(): Promise<void>;

  abstract signalIdle(): Promise<void>;

  abstract waitForIdle(): Promise<void>;

  abstract waitForWakeup(timeout?: number): Promise<boolean>;

  abstract sendToolResults(results: ToolResult[]): Promise<void>;

  abstract sendTriggerNotification(content: string): Promise<void>;
}

/**
 * Strategy for establishing a Connection to an agent backend.
 */
export abstract class ConnectionStrategy {
  abstract connect(): Connection;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
}
