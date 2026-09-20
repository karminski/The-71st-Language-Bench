import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { ROOT_DIR } from "./lib/paths.js";

loadDotenv({ path: path.join(ROOT_DIR, ".env") });

function readString(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${raw}`);
  }
  return value;
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

export type AppConfig = {
  baseUrl: string;
  apiKey: string;
  httpReferer: string;
  xTitle: string;
  targetModel: string;
  translateModel: string;
  judgeModel: string;
  sampleSizeHarmful: number;
  sampleSizeBenign: number;
  includeXstestUnsafe: boolean;
  seed: number;
  temperature: number;
  maxTokens: number;
  translateMaxTokens: number;
  judgeMaxTokens: number;
  concurrency: number;
  maxRetries: number;
  runId: string;
  newRun: boolean;
};

export function loadConfig(): AppConfig {
  return {
    baseUrl: readString("OPENAI_BASE_URL", "https://openrouter.ai/api/v1"),
    apiKey: readString("OPENAI_API_KEY"),
    httpReferer: readString(
      "HTTP_REFERER",
      "https://github.com/public/The-71st-Language-Bench",
    ),
    xTitle: readString("X_TITLE", "The 71st Language Bench"),
    targetModel: readString("TARGET_MODEL"),
    translateModel: readString("TRANSLATE_MODEL"),
    judgeModel: readString("JUDGE_MODEL"),
    sampleSizeHarmful: readNumber("SAMPLE_SIZE_HARMFUL", 150),
    sampleSizeBenign: readNumber("SAMPLE_SIZE_BENIGN", 150),
    includeXstestUnsafe: readBool("INCLUDE_XSTEST_UNSAFE", true),
    seed: readNumber("SEED", 42),
    temperature: readNumber("TEMPERATURE", 0),
    maxTokens: readNumber("MAX_TOKENS", 1024),
    translateMaxTokens: readNumber("TRANSLATE_MAX_TOKENS", 1024),
    judgeMaxTokens: readNumber("JUDGE_MAX_TOKENS", 256),
    concurrency: readNumber("CONCURRENCY", 5),
    maxRetries: readNumber("MAX_RETRIES", 5),
    runId: readString("RUN_ID"),
    newRun: readBool("NEW_RUN", false),
  };
}

export function requireApiKey(config: AppConfig): void {
  if (!config.apiKey) {
    throw new Error("OPENAI_API_KEY is required. Copy .env.example to .env and fill it in.");
  }
}

export function requireModel(name: string, value: string): void {
  if (!value) {
    throw new Error(`${name} is required in .env`);
  }
}
