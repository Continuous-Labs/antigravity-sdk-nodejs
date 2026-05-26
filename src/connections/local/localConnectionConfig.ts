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

import { AgentConfig, ConnectionStrategy } from "../connection.js";
import { LocalConnectionStrategy } from "./localConnection.js";
import {
  GeminiConfig,
  DEFAULT_MODEL,
  DEFAULT_IMAGE_GENERATION_MODEL
} from "../../types.js";

export class LocalAgentConfig extends AgentConfig {
  model?: string | null = DEFAULT_MODEL;
  api_key?: string | null = null;
  gemini_config: GeminiConfig = {
    api_key: null,
    models: {
      default: { name: DEFAULT_MODEL },
      image_generation: { name: DEFAULT_IMAGE_GENERATION_MODEL }
    }
  };

  constructor(options?: Partial<LocalAgentConfig>) {
    super();
    Object.assign(this, options);

    // Apply shorthand fields
    this.gemini_config = {
      api_key: this.api_key || this.gemini_config.api_key,
      models: {
        default: {
          name: this.model || this.gemini_config.models?.default?.name || DEFAULT_MODEL,
          api_key: this.api_key || this.gemini_config.models?.default?.api_key
        },
        image_generation: this.gemini_config.models?.image_generation || { name: DEFAULT_IMAGE_GENERATION_MODEL }
      }
    };

    if (this.workspaces.length === 0) {
      this.workspaces = [process.cwd()];
    }
  }

  createStrategy(toolRunner: any, hookRunner: any): ConnectionStrategy {
    return new LocalConnectionStrategy(toolRunner, hookRunner, this);
  }
}
