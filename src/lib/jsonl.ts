import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";

export function ensureParentDir(filePath: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

export function readJsonl<T>(filePath: string): T[] {
  if (!existsSync(filePath)) return [];
  const text = readFileSync(filePath, "utf8");
  if (!text.trim()) return [];
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line) as T;
      } catch {
        throw new Error(`Invalid JSONL at ${filePath}:${index + 1}`);
      }
    });
}

export function writeJsonl(filePath: string, rows: unknown[]): void {
  ensureParentDir(filePath);
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  writeFileSync(filePath, body ? `${body}\n` : "", "utf8");
}

export function appendJsonl(filePath: string, row: unknown): void {
  ensureParentDir(filePath);
  appendFileSync(filePath, `${JSON.stringify(row)}\n`, "utf8");
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function readJson<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(stripBom(readFileSync(filePath, "utf8"))) as T;
}

export function writeJson(filePath: string, value: unknown): void {
  ensureParentDir(filePath);
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
