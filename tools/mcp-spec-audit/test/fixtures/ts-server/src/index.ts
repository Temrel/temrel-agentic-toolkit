/*
 * Deliberately non-compliant MCP server fixture for scanner tests.
 * Every construct below should be flagged against the 2026-07-28 revision.
 * Do not fix this file; the tests depend on it.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { CreateTaskResult } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";

export type LegacyTaskResponse = CreateTaskResult;

const useStickySessions = true;

const server = new Server(
  { name: "legacy-demo", version: "0.1.0" },
  { capabilities: { logging: {}, tasks: {} } },
);

server.oninitialized = () => {
  void server.sendLoggingMessage({ level: "info", data: "client initialized" });
};

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});

export function attachSessionHeader(headers: Record<string, string>, id: string): void {
  headers["Mcp-Session-Id"] = id;
}

export async function summarize(text: string): Promise<unknown> {
  return server.createMessage({
    messages: [{ role: "user", content: { type: "text", text } }],
    maxTokens: 200,
  });
}

export async function workspaceRoots(): Promise<unknown> {
  return server.listRoots();
}

export const toolDeclaration = {
  name: "long_job",
  execution: { taskSupport: "optional" },
};

export function taskNotificationMethod(): string {
  return "notifications/tasks/status";
}

export function logNotificationMethod(): string {
  return "notifications/message";
}

export const immediateResponseMeta = {
  "io.modelcontextprotocol/model-immediate-response": "Job started, poll for results.",
};

export const stickyConfig = { useStickySessions };
