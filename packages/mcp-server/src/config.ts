export type Config = {
  apiUrl: string;
  // Optional: the API does not check tokens yet (see README), but it is sent
  // as a Bearer header when set so the server keeps working once it does.
  apiToken: string | undefined;
  timeoutMs: number;
};

const DEFAULT_API_URL = "http://localhost:3001";
const DEFAULT_TIMEOUT_MS = 10_000;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const rawUrl = env.WAREHOUSE_API_URL?.trim() || DEFAULT_API_URL;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ConfigError(`WAREHOUSE_API_URL is not a valid URL: ${rawUrl}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ConfigError("WAREHOUSE_API_URL must start with http:// or https://");
  }

  const rawTimeout = env.WAREHOUSE_API_TIMEOUT_MS?.trim();
  const timeoutMs = rawTimeout ? Number(rawTimeout) : DEFAULT_TIMEOUT_MS;

  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000) {
    throw new ConfigError(
      "WAREHOUSE_API_TIMEOUT_MS must be an integer between 100 and 120000",
    );
  }

  return {
    apiUrl: url.origin + url.pathname.replace(/\/+$/, ""),
    apiToken: env.WAREHOUSE_API_TOKEN?.trim() || undefined,
    timeoutMs,
  };
};
