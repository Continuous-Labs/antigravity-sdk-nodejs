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
 * Multimodal example for Google Antigravity SDK.
 *
 * This example demonstrates:
 * - Multimodal input: Passing images and documents to the agent.
 * - Multimodal output: Enabling the agent to generate images.
 *
 * To run:
 *   pnpm ts-node examples/getting_started/multimodal.ts
 */

import * as path from "path";
import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";
import { Image, Document, BuiltinTools } from "../../src/index.js";

async function main() {
  // Setup paths to resources
  const resourcesDir = path.resolve("examples/resources");
  const imagePath = path.join(resourcesDir, "example_image.png");
  const docPath = path.join(resourcesDir, "sample_doc.txt");

  // Multimodal Input: Image
  console.log("  --- Multimodal Input: Image ---");
  const config = new LocalAgentConfig({ model: "gemini-3.5-flash" });
  await Agent.run(config, async (my_agent) => {
    const image = Image.fromFile(imagePath);
    const prompt = ["What is in this image?", image];
    console.log(`  User: ${prompt[0]}`);
    const response = await my_agent.chat(prompt);
    const text = await response.text();
    console.log(`  Agent: ${text}\n`);
  });

  // Multimodal Input: Document
  console.log("  --- Multimodal Input: Document ---");
  await Agent.run(config, async (my_agent) => {
    const doc = Document.fromFile(docPath);
    const prompt = ["Summarize this document", doc];
    console.log(`  User: ${prompt[0]}`);
    const response = await my_agent.chat(prompt);
    const text = await response.text();
    console.log(`  Agent: ${text}\n`);
  });

  // Multimodal Output: Image Generation
  console.log("  --- Multimodal Output: Image Generation ---");
  const genConfig = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    capabilities: {
      enabled_tools: [BuiltinTools.GENERATE_IMAGE]
    }
  });

  await Agent.run(genConfig, async (gen_agent) => {
    const prompt =
      "Generate an image of a futuristic city, name it 'future_city'. " +
      "Please provide the file path to the generated image.";
    console.log(`  User: ${prompt}`);
    const response = await gen_agent.chat(prompt);
    const text = await response.text();
    console.log(`  Agent: ${text}\n`);
  });
}

main().catch(console.error);
