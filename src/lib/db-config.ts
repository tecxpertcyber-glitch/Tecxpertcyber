// ============================================================
// RUNTIME DATABASE CONFIG
// ============================================================
// Stores DB credentials provided by the admin at runtime,
// so the user can connect a database without redeploying or
// editing env vars. Used as a fallback when env vars are absent.
//
// Storage location:
//   - Local dev: ./data/db-config.json (persists forever)
//   - Vercel:    /tmp/db-config.json   (persists for the life of the
//                serverless instance — use env vars for permanent)
// ============================================================

import { promises as fs } from "fs";
import path from "path";

export interface RuntimeDbConfig {
  postgresUrl?: string;
  redisUrl?: string;
  redisToken?: string;
  configuredAt?: string;
  source?: "admin-panel";
}

const CONFIG_DIR_LOCAL = path.join(process.cwd(), "data");
const CONFIG_FILE_LOCAL = path.join(CONFIG_DIR_LOCAL, "db-config.json");
const CONFIG_FILE_TMP = "/tmp/tecxpert-db-config.json";

let configPathCache: string | null = null;
let cachedConfig: RuntimeDbConfig | null | undefined = undefined;

async function resolveConfigPath(): Promise<string> {
  if (configPathCache) return configPathCache;
  try {
    await fs.mkdir(CONFIG_DIR_LOCAL, { recursive: true });
    const testFile = path.join(CONFIG_DIR_LOCAL, ".write-test-config");
    await fs.writeFile(testFile, "", { flag: "w" });
    await fs.unlink(testFile);
    configPathCache = CONFIG_FILE_LOCAL;
  } catch {
    configPathCache = CONFIG_FILE_TMP;
  }
  return configPathCache;
}

export async function readRuntimeDbConfig(): Promise<RuntimeDbConfig | null> {
  if (cachedConfig !== undefined) return cachedConfig;
  try {
    const configPath = await resolveConfigPath();
    const raw = await fs.readFile(configPath, "utf-8");
    cachedConfig = JSON.parse(raw) as RuntimeDbConfig;
    return cachedConfig;
  } catch {
    cachedConfig = null;
    return null;
  }
}

export async function writeRuntimeDbConfig(
  config: RuntimeDbConfig
): Promise<void> {
  const configPath = await resolveConfigPath();
  const dir = path.dirname(configPath);
  await fs.mkdir(dir, { recursive: true }).catch(() => {});
  const tmp = `${configPath}.tmp`;
  await fs.writeFile(
    tmp,
    JSON.stringify({ ...config, configuredAt: new Date().toISOString(), source: "admin-panel" }, null, 2),
    "utf-8"
  );
  await fs.rename(tmp, configPath);
  cachedConfig = config;
}

export async function clearRuntimeDbConfig(): Promise<void> {
  try {
    const configPath = await resolveConfigPath();
    await fs.unlink(configPath);
  } catch {
    // already gone
  }
  cachedConfig = null;
}

export function clearConfigCache(): void {
  cachedConfig = undefined;
}

/**
 * Returns the storage location used for the runtime config file,
 * so we can warn the user about ephemeral storage on Vercel.
 */
export async function getRuntimeConfigPath(): Promise<{
  path: string;
  isPersistent: boolean;
}> {
  const p = await resolveConfigPath();
  return {
    path: p,
    isPersistent: p === CONFIG_FILE_LOCAL,
  };
}
