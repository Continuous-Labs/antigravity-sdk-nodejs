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
 * Multimodal input and output with the Agent API.
 *
 * Demonstrates a generator/discriminator pipeline using two independent
 * Agent instances:
 *
 *   1. **Generator** — creates an image using the built-in generate_image
 *      tool and saves it to disk.
 *
 *   2. **Discriminator** — a completely separate Agent with no shared
 *      history. Receives only the raw image bytes (no filename) via
 *      multimodal Content input and describes what it sees.
 *
 * To run:
 *   pnpm ts-node examples/deep_dives/multimodal_pipeline.ts
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Agent } from "../../src/agent.js";
import { LocalAgentConfig } from "../../src/connections/local/localConnectionConfig.js";
import { policy, BuiltinTools, Image, ChatResponse } from "../../src/index.js";

function printHeader(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

async function streamResponse(response: ChatResponse) {
  // Direct text streaming
  for await (const chunk of response) {
    process.stdout.write(chunk);
  }
  console.log();
}

function findGeneratedImage(name: string): string | null {
  const base = path.join(os.homedir(), ".gemini", "antigravity", "brain");
  if (!fs.existsSync(base)) {
    return null;
  }

  const findFilesRecursive = (dir: string): string[] => {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(findFilesRecursive(filePath));
      } else if (file.startsWith(name) && file.endsWith(".png")) {
        results.push(filePath);
      }
    }
    return results;
  };

  try {
    const matches = findFilesRecursive(base);
    if (matches.length > 0) {
      // Sort by modified time descending
      return matches.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    }
  } catch {
    // Ignored
  }
  return null;
}

async function main() {
  // ----------------------------------------------------------------
  // Phase 1: Generator — create an image
  // ----------------------------------------------------------------
  printHeader("Phase 1: Generator — creating image");

  const genConfig = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    system_instructions:
      "You are an image generation assistant. When asked to " +
      "generate an image, use the 'generate_image' tool. After " +
      "the image is created, tell the user the image name and " +
      "a one-line confirmation. Do not describe the image.",
    capabilities: {
      enabled_tools: [BuiltinTools.GENERATE_IMAGE]
    },
    policies: [
      policy.allow("generate_image", { name: "allow-gen" })
    ]
  });

  const prompt =
    "Generate an image of a white and orange Birman cat sitting " +
    "in front of a fish-shaped birthday cake with lit candles. " +
    "Name it 'birman_birthday'.";
  console.log(`>>> ${prompt}\n`);

  await Agent.run(genConfig, async (generator) => {
    const response = await generator.chat(prompt);
    await streamResponse(response);
  });

  // ----------------------------------------------------------------
  // Phase 2: Discriminator — describe the generated image
  // ----------------------------------------------------------------
  printHeader("Phase 2: Discriminator — describing image");

  const imagePath = findGeneratedImage("birman_birthday");
  if (!imagePath) {
    console.log("ERROR: Could not find generated image on disk.");
    console.log("The generate_image tool saves images as <name>_<ts>.png");
    console.log("under ~/.gemini/antigravity/brain/<conversation>/");
    return;
  }

  console.log(`  Found image: ${imagePath}`);
  console.log(`  Size: ${fs.statSync(imagePath).size.toLocaleString()} bytes`);

  const discConfig = new LocalAgentConfig({
    model: "gemini-3.5-flash",
    system_instructions:
      "You are a visual analysis assistant. You will receive " +
      "an image with no prior context. Describe exactly what " +
      "you see: subject matter, colors, lighting, mood, and " +
      "any notable details. Be specific and vivid."
  });

  // Load raw image bytes
  const image = Image.fromFile(imagePath);
  const discPrompt = [
    "What do you see in this image? Describe it in detail.",
    image
  ];
  console.log(">>> Sending raw image bytes to fresh agent...\n");

  await Agent.run(discConfig, async (discriminator) => {
    const response = await discriminator.chat(discPrompt);
    await streamResponse(response);
  });
}

main().catch(console.error);
