import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { basename, dirname, join } from "node:path";
import { homedir } from "node:os";
import { addUsage, emptyUsage, type SessionStats, type UsageTotals } from "./types.js";

/*
 * Parser for Claude Code session transcripts: JSONL files at
 * ~/.claude/projects/<encoded-project-dir>/<session-uuid>.jsonl
 *
 * Observed schema (verified against real transcripts, 2026-07):
 * - One JSON object per line, discriminated by a top-level "type" field.
 *   Types seen: assistant, user, system, attachment, queue-operation,
 *   last-prompt, custom-title, ai-title, mode, pr-link — new types appear
 *   over time, so anything unrecognized is ignored rather than an error.
 * - "assistant" entries carry message.model, message.usage
 *   ({input_tokens, output_tokens, cache_creation_input_tokens,
 *   cache_read_input_tokens, cache_creation: {ephemeral_5m_input_tokens,
 *   ephemeral_1h_input_tokens}}), message.id, and a top-level timestamp.
 * - CRITICAL: Claude Code writes one JSONL entry per assistant content
 *   block; all entries for the same API message share message.id and carry
 *   identical usage. Usage MUST be deduped by message.id or costs inflate
 *   ~2-3x. tool_use blocks are deduped by block id for the same reason.
 * - model can be "<synthetic>" for harness-generated messages — skipped.
 * - "user" entries are both real human prompts (origin.kind === "human",
 *   or message.content is a plain string) and tool results (content array).
 */

export const DEFAULT_PROJECTS_ROOT = join(homedir(), ".claude", "projects");

/** Encode a real filesystem path the way Claude Code names project dirs. */
export function encodeProjectPath(realPath: string): string {
  return realPath.replace(/[/.]/g, "-");
}

const SESSION_FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/;

/**
 * Find transcript files. `projectFilter` may be a real path (encoded before
 * matching) or an already-encoded project dir name.
 */
export async function discoverTranscripts(
  projectsRoot: string = DEFAULT_PROJECTS_ROOT,
  projectFilter?: string,
): Promise<string[]> {
  let dirs: string[];
  try {
    dirs = await readdir(projectsRoot);
  } catch {
    return [];
  }
  const encodedFilter = projectFilter
    ? projectFilter.includes("/")
      ? encodeProjectPath(projectFilter.replace(/\/+$/, ""))
      : projectFilter
    : undefined;

  const files: string[] = [];
  for (const dir of dirs) {
    if (encodedFilter && dir !== encodedFilter) continue;
    const dirPath = join(projectsRoot, dir);
    let entries: string[];
    try {
      const s = await stat(dirPath);
      if (!s.isDirectory()) continue;
      entries = await readdir(dirPath);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (SESSION_FILE_RE.test(entry)) files.push(join(dirPath, entry));
    }
  }
  return files.sort();
}

function usageFromEntry(rawUsage: Record<string, unknown>): UsageTotals {
  const u = emptyUsage();
  const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  u.input = num(rawUsage.input_tokens);
  u.output = num(rawUsage.output_tokens);
  u.cacheRead = num(rawUsage.cache_read_input_tokens);
  const totalWrite = num(rawUsage.cache_creation_input_tokens);
  const breakdown = rawUsage.cache_creation;
  if (breakdown && typeof breakdown === "object") {
    const b = breakdown as Record<string, unknown>;
    u.cacheWrite5m = num(b.ephemeral_5m_input_tokens);
    u.cacheWrite1h = num(b.ephemeral_1h_input_tokens);
    // Schema drift guard: if the breakdown doesn't sum to the total, put the
    // remainder in the unknown-TTL bucket rather than dropping tokens.
    const remainder = totalWrite - u.cacheWrite5m - u.cacheWrite1h;
    if (remainder > 0) u.cacheWriteUnknownTtl = remainder;
  } else {
    u.cacheWriteUnknownTtl = totalWrite;
  }
  return u;
}

export async function parseTranscript(filePath: string): Promise<SessionStats> {
  const stats: SessionStats = {
    sessionId: basename(filePath, ".jsonl"),
    project: basename(dirname(filePath)),
    filePath,
    usageByModel: new Map(),
    apiMessagesByModel: new Map(),
    firstTimestamp: null,
    lastTimestamp: null,
    userTurns: 0,
    assistantTurns: 0,
    toolCalls: 0,
    filesTouched: new Set(),
    skippedLines: 0,
    totalLines: 0,
  };

  const seenMessageIds = new Set<string>();
  const seenToolUseIds = new Set<string>();

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.trim() === "") continue;
    stats.totalLines++;

    let entry: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(line);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        stats.skippedLines++;
        continue;
      }
      entry = parsed as Record<string, unknown>;
    } catch {
      stats.skippedLines++;
      continue;
    }

    const ts = entry.timestamp;
    if (typeof ts === "string") {
      if (stats.firstTimestamp === null || ts < stats.firstTimestamp) stats.firstTimestamp = ts;
      if (stats.lastTimestamp === null || ts > stats.lastTimestamp) stats.lastTimestamp = ts;
    }

    if (entry.type === "assistant") {
      const message = entry.message;
      if (!message || typeof message !== "object") {
        stats.skippedLines++;
        continue;
      }
      const m = message as Record<string, unknown>;
      const model = typeof m.model === "string" ? m.model : null;
      const messageId = typeof m.id === "string" ? m.id : null;

      // Count tool_use blocks and files touched across all entries (each
      // entry holds distinct content blocks); dedupe blocks by their own id.
      const content = Array.isArray(m.content) ? m.content : [];
      for (const block of content) {
        if (!block || typeof block !== "object") continue;
        const b = block as Record<string, unknown>;
        if (b.type !== "tool_use") continue;
        const blockId = typeof b.id === "string" ? b.id : null;
        if (blockId !== null) {
          if (seenToolUseIds.has(blockId)) continue;
          seenToolUseIds.add(blockId);
        }
        stats.toolCalls++;
        if (b.name === "Edit" || b.name === "Write" || b.name === "NotebookEdit") {
          const input = b.input;
          if (input && typeof input === "object") {
            const path = (input as Record<string, unknown>).file_path ??
              (input as Record<string, unknown>).notebook_path;
            if (typeof path === "string") stats.filesTouched.add(path);
          }
        }
      }

      if (model === null || model === "<synthetic>") continue;

      // Usage dedupe: entries sharing message.id carry identical usage.
      if (messageId !== null && seenMessageIds.has(messageId)) continue;
      if (messageId !== null) seenMessageIds.add(messageId);
      stats.assistantTurns++;
      stats.apiMessagesByModel.set(model, (stats.apiMessagesByModel.get(model) ?? 0) + 1);

      const rawUsage = m.usage;
      if (rawUsage && typeof rawUsage === "object") {
        const usage = usageFromEntry(rawUsage as Record<string, unknown>);
        const existing = stats.usageByModel.get(model);
        if (existing) addUsage(existing, usage);
        else stats.usageByModel.set(model, usage);
      }
    } else if (entry.type === "user") {
      const message = entry.message;
      const origin = entry.origin;
      const originKind =
        origin && typeof origin === "object" ? (origin as Record<string, unknown>).kind : undefined;
      const content =
        message && typeof message === "object"
          ? (message as Record<string, unknown>).content
          : undefined;
      if (originKind === "human" || typeof content === "string") stats.userTurns++;
    }
    // All other entry types (system, attachment, queue-operation, ...) are
    // intentionally ignored — they carry no usage.
  }

  return stats;
}

export function sessionDurationMinutes(s: SessionStats): number | null {
  if (!s.firstTimestamp || !s.lastTimestamp) return null;
  const ms = Date.parse(s.lastTimestamp) - Date.parse(s.firstTimestamp);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / 60_000;
}

export interface LoadOptions {
  projectsRoot?: string;
  project?: string;
  sinceDays?: number;
  /** Injectable clock for tests. */
  now?: Date;
}

/** Discover, parse, and filter sessions. Read-only throughout. */
export async function loadSessions(opts: LoadOptions = {}): Promise<SessionStats[]> {
  const files = await discoverTranscripts(opts.projectsRoot, opts.project);
  const sessions: SessionStats[] = [];
  for (const file of files) {
    try {
      sessions.push(await parseTranscript(file));
    } catch {
      // Unreadable file (permissions, disappeared mid-run): skip, never crash.
    }
  }
  const sinceDays = opts.sinceDays ?? 30;
  const cutoff = new Date((opts.now ?? new Date()).getTime() - sinceDays * 86_400_000).toISOString();
  return sessions.filter(
    (s) => s.usageByModel.size > 0 && s.lastTimestamp !== null && s.lastTimestamp >= cutoff,
  );
}
