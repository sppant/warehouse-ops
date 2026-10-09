import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.resolve(apiDir, "../..");
const config = dotenv.config({ path: path.join(apiDir, ".env") }).parsed;
if (!config?.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from apps/api/.env");
}

const testUrl = new URL(config.DATABASE_URL);
testUrl.pathname = "/warehouse_ops_test";

const result = spawnSync(
  path.join(rootDir, "node_modules", ".bin", "vitest"),
  ["run", "--config", "vitest.integration.config.ts"],
  {
    cwd: apiDir,
    stdio: "inherit",
    env: { ...process.env, ...config, DATABASE_URL: testUrl.toString() },
  },
);

if (result.error) console.error("Failed to launch Vitest:", result.error);
process.exit(result.status ?? 1);
