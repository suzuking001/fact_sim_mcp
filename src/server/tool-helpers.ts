import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type LogLevel = "INFO" | "ERROR";

export function log(level: LogLevel, message: string, requestId?: string, details?: unknown): void {
  const prefix = `[${new Date().toISOString()}] [${level}]${requestId ? ` [req:${requestId}]` : ""} ${message}`;
  if (typeof details === "undefined") {
    console.error(prefix);
    return;
  }

  if (typeof details === "string") {
    console.error(`${prefix} ${details}`);
    return;
  }

  console.error(`${prefix} ${JSON.stringify(details)}`);
}

export function success(payload: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

export function failure(message: string): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: message
      }
    ]
  };
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

export function getMcpRoot(): string {
  const thisFilePath = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(thisFilePath);

  const repoCandidate = path.resolve(currentDir, "..", "..");
  if (existsSync(path.join(repoCandidate, "package.json"))) {
    return repoCandidate;
  }

  return path.resolve(currentDir, "..", "..", "..");
}

export function resolveFactSimRoot(mcpRoot: string): string {
  const envPath = (process.env.FACT_SIM_ROOT || "").trim();
  const candidate = envPath ? path.resolve(envPath) : path.resolve(mcpRoot, "..", "fact_sim");
  const marker = path.join(candidate, "index.html");
  if (!existsSync(marker)) {
    throw new Error(
      `fact_sim root not found at "${candidate}". Set FACT_SIM_ROOT to the directory containing index.html.`
    );
  }
  return candidate;
}
