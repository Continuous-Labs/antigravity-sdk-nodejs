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

import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { WebSocket } from "ws";
import { Connection, ConnectionStrategy } from "../connection.js";
import { encodeInputConfig, decodeOutputConfig } from "./protobuf.js";
import {
  Content,
  Step,
  StepType,
  StepSource,
  StepTarget,
  StepStatus,
  ToolResult,
  ToolCall,
  AntigravityConnectionError,
  AntigravityValidationError,
  BuiltinTools
} from "../../types.js";

function debugLog(...args: any[]) {
  if (process.env.ANTIGRAVITY_SDK_DEBUG) {
    console.log("[SDK Debug]", ...args);
  }
}

function getDefaultBinaryPath(): string {
  if (process.env.ANTIGRAVITY_HARNESS_PATH) {
    return process.env.ANTIGRAVITY_HARNESS_PATH;
  }
  const isWindows = process.platform === "win32";
  const exeName = isWindows ? "localharness.exe" : "localharness";
  const pathDirs = (process.env.PATH || "").split(path.delimiter);
  for (const dir of pathDirs) {
    const fullPath = path.join(dir, exeName);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return exeName;
}

function readBytes(stream: NodeJS.ReadableStream, count: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const readableStream = stream as any;

    // Try reading immediately
    const data = readableStream.read(count);
    if (data !== null) {
      return resolve(data);
    }

    const onReadable = () => {
      const chunk = readableStream.read(count);
      if (chunk !== null) {
        cleanup();
        resolve(chunk);
      }
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const onEnd = () => {
      cleanup();
      reject(new Error("Stream ended before reading requested bytes"));
    };
    const cleanup = () => {
      readableStream.removeListener("readable", onReadable);
      readableStream.removeListener("error", onError);
      readableStream.removeListener("end", onEnd);
    };
    readableStream.on("readable", onReadable);
    readableStream.on("error", onError);
    readableStream.on("end", onEnd);
  });
}

class AsyncQueue<T> {
  private _items: T[] = [];
  private _resolvers: { resolve: (value: IteratorResult<T>) => void; reject: (err: Error) => void }[] = [];
  private _done = false;
  private _error: Error | null = null;

  get length(): number {
    return this._items.length;
  }

  put(item: T): void {
    if (this._done) return;
    if (this._resolvers.length > 0) {
      const { resolve } = this._resolvers.shift()!;
      resolve({ value: item, done: false });
    } else {
      this._items.push(item);
    }
  }

  error(err: Error): void {
    this._error = err;
    while (this._resolvers.length > 0) {
      const { reject } = this._resolvers.shift()!;
      reject(err);
    }
  }

  close(): void {
    this._done = true;
    while (this._resolvers.length > 0) {
      const { resolve } = this._resolvers.shift()!;
      resolve({ value: undefined as any, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    const self = this;
    return {
      async next(): Promise<IteratorResult<T>> {
        if (self._items.length > 0) {
          return { value: self._items.shift()!, done: false };
        }
        if (self._error) {
          throw self._error;
        }
        if (self._done) {
          return { value: undefined as any, done: true };
        }
        return new Promise((resolve, reject) => {
          self._resolvers.push({ resolve, reject });
        });
      }
    };
  }
}

export class LocalConnection extends Connection {
  private _process: ChildProcess;
  private _ws: WebSocket;
  private _toolRunner: any;
  private _hookRunner: any;
  private _stepQueue = new AsyncQueue<Step>();
  private _stderrLines: string[] = [];
  private _disconnecting = false;
  private _idleResolver: (() => void)[] = [];
  private _isIdleState = true;
  private _conversationId = "";

  private _activeSubagentIds = new Set<string>();
  private _parentIdle = false;
  private _handledRequests = new Set<string>();

  constructor(proc: ChildProcess, ws: WebSocket, toolRunner: any, hookRunner: any) {
    super();
    this._process = proc;
    this._ws = ws;
    this._toolRunner = toolRunner;
    this._hookRunner = hookRunner;

    this._startStderrReader();
    this._startWSReader();
  }

  get isIdle(): boolean {
    return this._isIdleState;
  }

  get conversationId(): string {
    return this._conversationId;
  }

  private _startStderrReader() {
    this._process.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf-8");
      console.error("[Harness Stderr]:", text.trim());
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.trim()) {
          this._stderrLines.push(line);
          if (this._stderrLines.length > 50) {
            this._stderrLines.shift();
          }
        }
      }
    });
  }

  private _startWSReader() {
    this._ws.on("message", async (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString("utf-8"));
        debugLog("WS Event Received:", JSON.stringify(event, null, 2));
        await this._handleWSEvent(event);
      } catch (err: any) {
        this._stepQueue.error(err);
      }
    });

    this._ws.on("close", (code) => {
      debugLog("WS ON CLOSE CALLED, code:", code, "disconnecting:", this._disconnecting);
      if (!this._disconnecting) {
        const tail = this._stderrLines.join("\n") || "(no stderr output)";
        const errMsg = `Harness process exited unexpectedly (WS close code ${code}).\nHarness stderr:\n${tail}`;
        this._stepQueue.error(new AntigravityConnectionError(errMsg));
      } else {
        this._stepQueue.close();
      }
    });

    this._ws.on("error", (err) => {
      debugLog("WS ON ERROR CALLED:", err);
      this._stepQueue.error(err);
    });
  }

  private async _handleWSEvent(event: any) {
    if (event.stepUpdate || event.step_update) {
      const update = event.stepUpdate || event.step_update;
      this._conversationId = update.cascadeId || update.cascade_id || this._conversationId;
      debugLog("stepUpdate processed. _conversationId is now:", this._conversationId);

      // Map StepUpdate to SDK Step
      const step: Step = {
        id: `${update.trajectoryId || update.trajectory_id}:${update.stepIndex ?? update.step_index}`,
        step_index: update.stepIndex ?? update.step_index,
        type: this._mapStepType(update),
        source: this._mapSource(update.source),
        target: this._mapTarget(update.target),
        status: this._mapStatus(update.state),
        content: update.text || update.errorMessage || update.error_message || "",
        content_delta: update.textDelta || update.text_delta || "",
        thinking: update.thinking || "",
        thinking_delta: update.thinkingDelta || update.thinking_delta || "",
        tool_calls: this._mapToolCalls(update),
        error: update.errorMessage || update.error_message || "",
        is_complete_response: (update.state === "STATE_DONE") && (update.source === "SOURCE_MODEL") && (update.target === "TARGET_USER")
      };

      this._stepQueue.put(step);

      // Handle Waiting State
      if (update.state === "STATE_WAITING_FOR_USER") {
        if (update.questionsRequest || update.questions_request) {
          const reqId = `q:${update.trajectoryId || update.trajectory_id}:${update.stepIndex ?? update.step_index}`;
          if (!this._handledRequests.has(reqId)) {
            this._handledRequests.add(reqId);
            this._handleQuestionRequest(update);
          }
        }
        if (update.toolConfirmationRequest || update.tool_confirmation_request) {
          const reqId = `tc:${update.trajectoryId || update.trajectory_id}:${update.stepIndex ?? update.step_index}`;
          if (!this._handledRequests.has(reqId)) {
            this._handledRequests.add(reqId);
            this._handleToolConfirmationRequest(update);
          }
        }
      }
    } else if (event.trajectory_state_update || event.trajectoryStateUpdate) {
      const tsu = event.trajectory_state_update || event.trajectoryStateUpdate;
      const tsuTrajId = tsu.trajectoryId || tsu.trajectory_id;
      const isSubagent = !!this._conversationId && tsuTrajId !== this._conversationId;
      debugLog("trajectoryStateUpdate received. trajectoryId:", tsuTrajId, "isSubagent:", isSubagent, "conversationId:", this._conversationId);

      if (tsu.state === "STATE_RUNNING") {
        this._isIdleState = false;
        debugLog("_isIdleState set to false due to STATE_RUNNING");
        if (isSubagent) {
          this._activeSubagentIds.add(tsuTrajId);
        }
      } else if (tsu.state === "STATE_IDLE") {
        if (isSubagent) {
          this._activeSubagentIds.delete(tsuTrajId);
        } else {
          this._parentIdle = true;
        }

        if (this._parentIdle && this._activeSubagentIds.size === 0) {
          this._isIdleState = true;
          debugLog("_isIdleState set to true due to STATE_IDLE and active subagents size 0");
          this._stepQueue.put(null as any);
          const resolvers = this._idleResolver;
          this._idleResolver = [];
          for (const resolve of resolvers) {
            resolve();
          }
        }
      }
    } else if (event.tool_call) {
      this._handleToolCall(event.tool_call);
    }
  }

  private _mapStepType(update: any): StepType {
    if (update.text) return StepType.TEXT_RESPONSE;
    if (update.run_command || update.view_file || update.create_file || update.edit_file || update.list_directory || update.search_directory || update.find_file) return StepType.TOOL_CALL;
    if (update.compaction) return StepType.COMPACTION;
    if (update.finish) return StepType.FINISH;
    return StepType.UNKNOWN;
  }

  private _mapSource(src: string): StepSource {
    const s = String(src).toUpperCase();
    if (s.includes("SYSTEM")) return StepSource.SYSTEM;
    if (s.includes("USER")) return StepSource.USER;
    if (s.includes("MODEL")) return StepSource.MODEL;
    return StepSource.UNKNOWN;
  }

  private _mapTarget(target: string): StepTarget {
    const t = String(target).toUpperCase();
    if (t.includes("USER")) return StepTarget.USER;
    if (t.includes("ENVIRONMENT")) return StepTarget.ENVIRONMENT;
    if (t.includes("UNSPECIFIED")) return StepTarget.UNSPECIFIED;
    return StepTarget.UNKNOWN;
  }

  private _mapStatus(state: string): StepStatus {
    const s = String(state).toUpperCase();
    if (s.includes("ACTIVE")) return StepStatus.ACTIVE;
    if (s.includes("DONE")) return StepStatus.DONE;
    if (s.includes("WAITING_FOR_USER")) return StepStatus.WAITING_FOR_USER;
    if (s.includes("ERROR")) return StepStatus.ERROR;
    return StepStatus.UNKNOWN;
  }

  private _mapToolCalls(update: any): ToolCall[] {
    const list: ToolCall[] = [];
    if (update.run_command) {
      list.push({ name: BuiltinTools.RUN_COMMAND, args: { CommandLine: update.run_command.command_line } });
    }
    if (update.view_file) {
      list.push({ name: BuiltinTools.VIEW_FILE, args: { AbsolutePath: update.view_file.file_path, StartLine: update.view_file.start_line, EndLine: update.view_file.end_line } });
    }
    if (update.create_file) {
      list.push({ name: BuiltinTools.CREATE_FILE, args: { TargetFile: update.create_file.file_path, CodeContent: update.create_file.contents } });
    }
    return list;
  }

  private async _handleQuestionRequest(update: any) {
    try {
      const questionsReq = update.questionsRequest || update.questions_request;
      const answers = questionsReq.questions.map(() => ({ unanswered: true }));
      await this._sendQuestionResponse(update, answers);
    } catch (err) {
      const errorAnswer = {
        multipleChoiceAnswer: {
          freeformResponse: `SDK error processing question: ${err}`
        }
      };
      await this._sendQuestionResponse(update, [errorAnswer]);
    }
  }

  private async _sendQuestionResponse(update: any, answers: any[]) {
    const resp = {
      questionResponse: {
        trajectoryId: update.trajectoryId || update.trajectory_id,
        stepIndex: update.stepIndex ?? update.step_index,
        response: {
          answers
        }
      }
    };
    this._ws.send(JSON.stringify(resp));
  }

  private async _handleToolConfirmationRequest(update: any) {
    // Default approve
    let allow = true;
    if (this._hookRunner) {
      // Implement hook checks in execute phase
    }
    await this._sendToolConfirmation(update, allow);
  }

  private async _sendToolConfirmation(update: any, accepted: boolean) {
    const resp = {
      toolConfirmation: {
        trajectoryId: update.trajectoryId || update.trajectory_id,
        stepIndex: update.stepIndex ?? update.step_index,
        accepted
      }
    };
    this._ws.send(JSON.stringify(resp));
  }

  private async _handleToolCall(toolCall: any) {
    try {
      const args = JSON.parse(toolCall.arguments_json || "{}");
      if (this._toolRunner) {
        const results = await this._toolRunner.processToolCalls([{ name: toolCall.name, args }]);
        const res = results[0];
        res.id = toolCall.id;
        await this.sendToolResults([res]);
      }
    } catch (err: any) {
      await this.sendToolResults([{
        name: toolCall.name,
        id: toolCall.id,
        error: `Internal SDK error: ${err}`
      }]);
    }
  }

  async send(prompt: Content | null, _options?: Record<string, any>): Promise<void> {
    debugLog("send() called. Setting _isIdleState to false");
    this._isIdleState = false;
    this._parentIdle = false;
    this._activeSubagentIds.clear();
    const parts = this._toProtoParts(prompt);

    const inputEvent = {
      complexUserInput: {
        parts
      }
    };

    this._ws.send(JSON.stringify(inputEvent));
  }

  private _toProtoParts(prompt: Content | null): any[] {
    if (!prompt) return [];
    const arr = Array.isArray(prompt) ? prompt : [prompt];
    return arr.map(item => {
      if (typeof item === "string") {
        return { text: item };
      }
      const mediaItem = item as any;
      return {
        media: {
          mimeType: mediaItem.mime_type || mediaItem.mimeType,
          data: mediaItem.data.toString("base64"),
          description: mediaItem.description || ""
        }
      };
    });
  }

  async *receiveSteps(): AsyncGenerator<Step, void, unknown> {
    debugLog("receiveSteps() called. _isIdleState:", this._isIdleState, "queue length:", this._stepQueue.length);
    const queue = this._stepQueue;
    const iterator = queue[Symbol.asyncIterator]();
    while (true) {
      if (this._isIdleState && queue.length === 0) {
        debugLog("receiveSteps() breaking because _isIdleState is true and queue is empty");
        await new Promise(resolve => setTimeout(resolve, 50));
        if (queue.length === 0) {
          break;
        }
      }
      const res = await iterator.next();
      if (res.done) break;
      if (res.value === null) {
        continue;
      }
      const step = res.value;
      if (step.status === StepStatus.ERROR) {
        throw new AntigravityConnectionError(step.error || "An error occurred in the harness step");
      }
      yield step;
    }
  }

  async sendToolResults(results: ToolResult[]): Promise<void> {
    for (const res of results) {
      const resp = {
        toolResponse: {
          id: res.id,
          responseJson: JSON.stringify(res.error ? { error: res.error } : (typeof res.result === "object" ? res.result : { result: res.result }))
        }
      };
      this._ws.send(JSON.stringify(resp));
    }
  }

  async sendTriggerNotification(content: string): Promise<void> {
    const event = {
      automatedTrigger: content
    };
    this._ws.send(JSON.stringify(event));
  }

  async cancel(): Promise<void> {
    // Send cancel event over stdin/stdout or WS if supported, or terminate turn.
  }

  async delete(): Promise<void> {
    await this.disconnect();
  }

  async signalIdle(): Promise<void> {
    // Handled by localharness
  }

  async waitForIdle(): Promise<void> {
    if (this._isIdleState) return;
    return new Promise((resolve) => {
      this._idleResolver.push(resolve);
    });
  }

  async waitForWakeup(_timeout = 300000): Promise<boolean> {
    return false;
  }

  async disconnect(): Promise<void> {
    this._disconnecting = true;
    this._ws.close();
    this._process.kill();
  }
}

export class LocalConnectionStrategy extends ConnectionStrategy {
  private _binaryPath: string;
  private _saveDir: string;
  private _toolRunner: any;
  private _hookRunner: any;
  private _config: any;
  private _connection: LocalConnection | null = null;

  constructor(
    toolRunner: any,
    hookRunner: any,
    config: any
  ) {
    super();
    this._toolRunner = toolRunner;
    this._hookRunner = hookRunner;
    this._config = config;
    this._binaryPath = getDefaultBinaryPath();
    this._saveDir = config.save_dir || path.join(os.tmpdir(), `antigravity_${Date.now()}`);
  }

  connect(): Connection {
    if (!this._connection) {
      throw new Error("Connection not started. Call start() first.");
    }
    return this._connection;
  }

  async start(): Promise<void> {
    const api_key = this._config.api_key || process.env.GEMINI_API_KEY;
    if (!api_key) {
      throw new AntigravityValidationError("A Gemini API key is required. Set GEMINI_API_KEY in the environment.");
    }

    if (!fs.existsSync(this._saveDir)) {
      fs.mkdirSync(this._saveDir, { recursive: true });
    }

    // Spawn Subprocess
    const proc = spawn(this._binaryPath, [], { stdio: ["pipe", "pipe", "pipe"] });

    // Write InputConfig
    const serialized = encodeInputConfig(this._saveDir);
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(serialized.length, 0);

    proc.stdin!.write(Buffer.concat([lenBuf, serialized]));

    // Read OutputConfig
    const rawLen = await readBytes(proc.stdout!, 4);
    const length = rawLen.readUInt32LE(0);
    const outBytes = await readBytes(proc.stdout!, length);
    const outConfig = decodeOutputConfig(outBytes);

    const wsUrl = `ws://localhost:${outConfig.port}/`;

    // Wait and connect WS
    let ws: WebSocket | null = null;
    let retries = 5;
    for (let i = 0; i < retries; i++) {
      try {
        ws = new WebSocket(wsUrl, {
          headers: { "x-goog-api-key": outConfig.api_key || api_key }
        });
        await new Promise((resolve, reject) => {
          ws!.on("open", () => {
            resolve(null);
          });
          ws!.on("error", (err) => {
            reject(err);
          });
        });
        break;
      } catch (err: any) {
        if (i === retries - 1) {
          proc.kill();
          throw new Error(`Failed to connect to localharness WS: ${err.message}`);
        }
        await new Promise((r) => setTimeout(r, 100 * Math.pow(2, i)));
      }
    }

    // Initialize Conversation JSON Event
    const initEvent = {
      config: {
        cascadeId: this._config.conversation_id || this._config.conversationId || "",
        appDataDir: this._config.app_data_dir || this._config.appDataDir || "",
        workspaces: (this._config.workspaces || []).map((wsPath: string) => ({
          filesystemWorkspace: { directory: wsPath }
        })),
        skillsPaths: this._config.skills_paths || this._config.skillsPaths || [],
        harnessSideTools: {
          subagents: { enabled: this._config.capabilities?.enable_subagents !== false },
          find: { enabled: true },
          userQuestions: { enabled: true },
          runCommand: { enabled: true },
          fileEdit: { enabled: true },
          viewFile: { enabled: true },
          writeToFile: { enabled: true },
          grepSearch: { enabled: true },
          listDir: { enabled: true }
        }
      }
    };

    ws!.send(JSON.stringify({ config: initEvent.config }));

    this._connection = new LocalConnection(proc, ws!, this._toolRunner, this._hookRunner);
  }

  async stop(): Promise<void> {
    if (this._connection) {
      await this._connection.disconnect();
      this._connection = null;
    }
  }
}
