import { readFile } from "node:fs/promises";
import type { AxisProxy, RouterConfig } from "./types.js";
import { DEFAULT_CONFIG_PATH } from "./pricing.js";

function validAxis(a: unknown): a is AxisProxy {
  if (!a || typeof a !== "object") return false;
  const p = a as Record<string, unknown>;
  return (
    typeof p.metric === "string" &&
    ["filesTouched", "userTurns", "toolCalls", "durationMinutes"].includes(p.metric) &&
    typeof p.scoreTwoAt === "number" &&
    typeof p.scoreThreeAt === "number" &&
    p.scoreTwoAt <= p.scoreThreeAt
  );
}

export async function loadConfig(path: string = DEFAULT_CONFIG_PATH): Promise<RouterConfig> {
  const raw = JSON.parse(await readFile(path, "utf8")) as RouterConfig;
  const a = raw.audit;
  if (
    !a ||
    typeof a.maxToolCalls !== "number" ||
    typeof a.maxAssistantTurns !== "number" ||
    typeof a.maxDurationMinutes !== "number" ||
    !Array.isArray(a.overkillTiers) ||
    typeof a.downgradeToModel !== "string"
  ) {
    throw new Error(`Invalid router config at ${path}: bad or missing "audit" section`);
  }
  const c = raw.calibrate;
  if (!c || !validAxis(c.scope) || !validAxis(c.novelty) || !validAxis(c.risk) || !validAxis(c.iteration)) {
    throw new Error(`Invalid router config at ${path}: bad or missing "calibrate" section`);
  }
  return raw;
}
