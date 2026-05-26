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
 * Type definitions for Google Antigravity SDK.
 */

// =============================================================================
// Config types
// =============================================================================

export const DEFAULT_MODEL = "gemini-3.5-flash";
export const DEFAULT_IMAGE_GENERATION_MODEL = "gemini-3.1-flash-image-preview";

export enum ThinkingLevel {
  MINIMAL = "minimal",
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export interface GenerationConfig {
  thinking_level?: ThinkingLevel | null;
}

export interface ModelEntry {
  name: string;
  api_key?: string | null;
  generation?: GenerationConfig;
}

export interface ModelConfig {
  default: ModelEntry;
  image_generation: ModelEntry;
}

export interface GeminiConfig {
  api_key?: string | null;
  models?: Partial<ModelConfig>;
}

export interface SystemInstructionSection {
  content: string;
  title?: string;
}

export interface CustomSystemInstructions {
  text: string;
}

export interface TemplatedSystemInstructions {
  identity?: string | null;
  sections?: SystemInstructionSection[];
}

export type SystemInstructions = CustomSystemInstructions | TemplatedSystemInstructions;

export enum BuiltinTools {
  LIST_DIR = "list_directory",
  SEARCH_DIR = "search_directory",
  FIND_FILE = "find_file",
  VIEW_FILE = "view_file",
  CREATE_FILE = "create_file",
  EDIT_FILE = "edit_file",
  RUN_COMMAND = "run_command",
  ASK_QUESTION = "ask_question",
  START_SUBAGENT = "start_subagent",
  GENERATE_IMAGE = "generate_image",
  FINISH = "finish",
}

export namespace BuiltinToolsHelper {
  export function readOnly(): BuiltinTools[] {
    return [
      BuiltinTools.LIST_DIR,
      BuiltinTools.SEARCH_DIR,
      BuiltinTools.FIND_FILE,
      BuiltinTools.VIEW_FILE,
      BuiltinTools.FINISH,
    ];
  }

  export function nondestructive(): BuiltinTools[] {
    return [
      BuiltinTools.LIST_DIR,
      BuiltinTools.SEARCH_DIR,
      BuiltinTools.FIND_FILE,
      BuiltinTools.VIEW_FILE,
      BuiltinTools.CREATE_FILE,
      BuiltinTools.EDIT_FILE,
      BuiltinTools.ASK_QUESTION,
      BuiltinTools.START_SUBAGENT,
      BuiltinTools.GENERATE_IMAGE,
      BuiltinTools.FINISH,
    ];
  }

  export function fileTools(): BuiltinTools[] {
    return [
      BuiltinTools.VIEW_FILE,
      BuiltinTools.CREATE_FILE,
      BuiltinTools.EDIT_FILE,
    ];
  }
}

export interface CapabilitiesConfig {
  enable_subagents?: boolean;
  enabled_tools?: BuiltinTools[] | null;
  disabled_tools?: BuiltinTools[] | null;
  compaction_threshold?: number | null;
  image_model?: string;
  finish_tool_schema_json?: string | null;
}

export interface McpStdioServer {
  type: "stdio";
  command: string;
  args?: string[];
}

export interface McpSseServer {
  type: "sse";
  url: string;
  headers?: Record<string, string> | null;
}

export interface McpStreamableHttpServer {
  type: "http";
  url: string;
  headers?: Record<string, string> | null;
  timeout?: number;
  sse_read_timeout?: number;
  terminate_on_close?: boolean;
}

export type McpServerConfig = McpStdioServer | McpSseServer | McpStreamableHttpServer;

// =============================================================================
// Tool types
// =============================================================================

export interface ToolCall {
  name: BuiltinTools | string;
  args: Record<string, any>;
  id?: string | null;
  canonical_path?: string | null;
}

export interface ToolResult {
  name: BuiltinTools | string;
  id?: string | null;
  result?: any;
  error?: string | null;
  exception?: Error | null;
}

export type JavaScriptTool = (...args: any[]) => any | Promise<any>;

// =============================================================================
// Step types
// =============================================================================

export interface UsageMetadata {
  prompt_token_count?: number | null;
  cached_content_token_count?: number | null;
  candidates_token_count?: number | null;
  thoughts_token_count?: number | null;
  total_token_count?: number | null;
}

export enum StepType {
  TEXT_RESPONSE = "TEXT_RESPONSE",
  TOOL_CALL = "TOOL_CALL",
  SYSTEM_MESSAGE = "SYSTEM_MESSAGE",
  COMPACTION = "COMPACTION",
  FINISH = "FINISH",
  UNKNOWN = "UNKNOWN",
}

export enum StepSource {
  SYSTEM = "SYSTEM",
  USER = "USER",
  MODEL = "MODEL",
  UNKNOWN = "UNKNOWN",
}

export enum StepTarget {
  USER = "TARGET_USER",
  ENVIRONMENT = "TARGET_ENVIRONMENT",
  UNSPECIFIED = "TARGET_UNSPECIFIED",
  UNKNOWN = "UNKNOWN",
}

export enum StepStatus {
  ACTIVE = "ACTIVE",
  DONE = "DONE",
  WAITING_FOR_USER = "WAITING_FOR_USER",
  ERROR = "ERROR",
  CANCELED = "CANCELED",
  UNKNOWN = "UNKNOWN",
}

export interface Step {
  id: string;
  step_index: number;
  type: StepType;
  source: StepSource;
  target: StepTarget;
  status: StepStatus;
  content: string;
  content_delta: string;
  thinking: string;
  thinking_delta: string;
  tool_calls: ToolCall[];
  error: string;
  is_complete_response?: boolean | null;
  structured_output?: any;
  usage_metadata?: UsageMetadata | null;
}

// =============================================================================
// Hook & Interaction types
// =============================================================================

export interface HookResult {
  allow: boolean;
  message?: string;
}

export interface QuestionResponse {
  selected_option_ids?: string[] | null;
  freeform_response?: string;
  skipped?: boolean;
}

export interface QuestionHookResult {
  responses: QuestionResponse[];
  cancelled?: boolean;
}

export interface AskQuestionOption {
  id: string;
  text: string;
}

export interface AskQuestionEntry {
  question: string;
  options: AskQuestionOption[];
  is_multi_select?: boolean;
}

export interface AskQuestionInteractionSpec {
  questions: AskQuestionEntry[];
}

export enum TriggerDelivery {
  SEND_IMMEDIATELY = "send_immediately",
  WAIT_IDLE = "wait_idle",
}

export enum FileChangeKind {
  ADDED = "added",
  MODIFIED = "modified",
  DELETED = "deleted",
}

export interface FileChange {
  kind: FileChangeKind;
  path: string;
}

// =============================================================================
// Response types & StreamChunks
// =============================================================================

export interface StreamChunk {
  step_index: number;
  type: "thought" | "text" | "tool_call";
}

export interface Thought extends StreamChunk {
  type: "thought";
  text: string;
  signature?: Buffer | null;
}

export interface Text extends StreamChunk {
  type: "text";
  text: string;
}

export type ChatChunk = Thought | Text | ToolCall;

// =============================================================================
// Errors
// =============================================================================

export class AntigravityConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AntigravityConnectionError";
  }
}

export class AntigravityValidationError extends Error {
  errors: any[];

  constructor(message: string, errors: any[] = []) {
    super(message);
    this.name = "AntigravityValidationError";
    this.errors = errors;
  }
}

// =============================================================================
// Media Primitives
// =============================================================================

export interface ImagePrimitive {
  type: "image";
  data: Buffer;
  mime_type: string;
  description?: string | null;
}

export interface DocumentPrimitive {
  type: "document";
  data: Buffer;
  mime_type: string;
  description?: string | null;
}

export interface AudioPrimitive {
  type: "audio";
  data: Buffer;
  mime_type: string;
  description?: string | null;
}

export interface VideoPrimitive {
  type: "video";
  data: Buffer;
  mime_type: string;
  description?: string | null;
}

import * as fs from "fs";
import * as path from "path";

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    case ".txt": return "text/plain";
    case ".pdf": return "application/pdf";
    case ".md": return "text/markdown";
    case ".json": return "application/json";
    case ".mp3": return "audio/mp3";
    case ".wav": return "audio/wav";
    case ".mp4": return "video/mp4";
    default: return "application/octet-stream";
  }
}

export class Image {
  static fromFile(filePath: string, description?: string | null): ImagePrimitive {
    const data = fs.readFileSync(filePath);
    const mime_type = getMimeType(filePath);
    return {
      type: "image",
      data,
      mime_type,
      description
    };
  }

  static from_file(filePath: string, description?: string | null): ImagePrimitive {
    return Image.fromFile(filePath, description);
  }
}

export class Document {
  static fromFile(filePath: string, description?: string | null): DocumentPrimitive {
    const data = fs.readFileSync(filePath);
    const mime_type = getMimeType(filePath);
    return {
      type: "document",
      data,
      mime_type,
      description
    };
  }

  static from_file(filePath: string, description?: string | null): DocumentPrimitive {
    return Document.fromFile(filePath, description);
  }
}

export type ContentPrimitive = string | ImagePrimitive | DocumentPrimitive | AudioPrimitive | VideoPrimitive;
export type Content = ContentPrimitive | ContentPrimitive[];

// =============================================================================
// ChatResponse implementation
// =============================================================================

export class ChatResponse implements AsyncIterable<string> {
  private _chunkStream: AsyncIterator<ChatChunk>;
  private _conversation: any;
  private _bufferedChunks: ChatChunk[] = [];
  private _isDone = false;
  private _streamError: Error | null = null;
  private _pendingPull: Promise<void> | null = null;

  constructor(chunkStream: AsyncIterator<ChatChunk>, conversation: any) {
    this._chunkStream = chunkStream;
    this._conversation = conversation;
  }

  /**
   * The rich, unfiltered semantic chunk stream for advanced use cases.
   * Multiple independent consumers can safely stream simultaneously from the shared buffer.
   */
  get chunks(): AsyncIterator<ChatChunk> {
    const self = this;
    let pos = 0;

    return {
      async next(): Promise<IteratorResult<ChatChunk>> {
        while (true) {
          if (pos < self._bufferedChunks.length) {
            const chunk = self._bufferedChunks[pos++];
            return { value: chunk, done: false };
          }

          if (self._isDone) {
            if (self._streamError) {
              throw self._streamError;
            }
            return { value: undefined as any, done: true };
          }

          // Serialize network pulls using a simple promise queue
          if (!self._pendingPull) {
            self._pendingPull = (async () => {
              try {
                const res = await self._chunkStream.next();
                if (res.done) {
                  self._isDone = true;
                } else {
                  self._bufferedChunks.push(res.value);
                }
              } catch (err: any) {
                self._isDone = true;
                self._streamError = err;
                throw err;
              } finally {
                self._pendingPull = null;
              }
            })();
          }

          await self._pendingPull;
        }
      }
    };
  }

  /**
   * Streams conversational text token deltas directly as raw strings.
   */
  async *[Symbol.asyncIterator](): AsyncIterator<string> {
    const chunkIterator = this.chunks;
    while (true) {
      const res = await chunkIterator.next();
      if (res.done) break;
      const chunk = res.value;
      if (chunk && "type" in chunk && chunk.type === "text") {
        yield (chunk as Text).text;
      }
    }
  }

  /**
   * The internal model reasoning/thinking token deltas as raw strings.
   */
  get thoughts(): AsyncIterator<string> {
    const chunkIterator = this.chunks;
    return {
      async next(): Promise<IteratorResult<string>> {
        while (true) {
          const res = await chunkIterator.next();
          if (res.done) return { value: undefined as any, done: true };
          const chunk = res.value;
          if (chunk && "type" in chunk && chunk.type === "thought") {
            return { value: (chunk as Thought).text, done: false };
          }
        }
      }
    };
  }

  /**
   * The strongly-typed ToolCall objects in real-time as they are dispatched.
   */
  get tool_calls(): AsyncIterator<ToolCall> {
    const chunkIterator = this.chunks;
    return {
      async next(): Promise<IteratorResult<ToolCall>> {
        while (true) {
          const res = await chunkIterator.next();
          if (res.done) return { value: undefined as any, done: true };
          const chunk = res.value;
          if (chunk && !("type" in chunk)) {
            return { value: chunk as ToolCall, done: false };
          }
        }
      }
    };
  }

  /**
   * Drains the underlying stream completely and returns all chunks as a flat list.
   */
  async resolve(): Promise<ChatChunk[]> {
    const results: ChatChunk[] = [];
    const chunkIterator = this.chunks;
    while (true) {
      const res = await chunkIterator.next();
      if (res.done) break;
      results.push(res.value);
    }
    return results;
  }

  /**
   * Drains the stream and returns the fully aggregated conversational response text.
   */
  async text(): Promise<string> {
    const chunks = await this.resolve();
    let result = "";
    for (const chunk of chunks) {
      if ("type" in chunk && chunk.type === "text") {
        result += (chunk as Text).text;
      }
    }
    return result;
  }

  /**
   * Drains the stream and extracts the parsed structured output payload, if one exists.
   */
  async structured_output(): Promise<any> {
    if (!this._isDone) {
      await this.resolve();
    }
    return this._conversation.getLastStructuredOutput();
  }

  /**
   * Accumulated token usage across all model invocations in this turn.
   */
  get usage_metadata(): UsageMetadata | null {
    return this._conversation.lastTurnUsage;
  }
}
