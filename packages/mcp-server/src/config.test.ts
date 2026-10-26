import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("uses defaults when nothing is set", () => {
    expect(loadConfig({})).toEqual({
      apiUrl: "http://localhost:3001",
      apiToken: undefined,
      timeoutMs: 10_000,
    });
  });

  it("strips trailing slashes and reads the token", () => {
    const config = loadConfig({
      WAREHOUSE_API_URL: "https://wh.example.com/",
      WAREHOUSE_API_TOKEN: " secret ",
    });

    expect(config.apiUrl).toBe("https://wh.example.com");
    expect(config.apiToken).toBe("secret");
  });

  it("rejects a bad URL, protocol or timeout", () => {
    expect(() => loadConfig({ WAREHOUSE_API_URL: "nope" })).toThrow(ConfigError);
    expect(() => loadConfig({ WAREHOUSE_API_URL: "ftp://x.com" })).toThrow(ConfigError);
    expect(() => loadConfig({ WAREHOUSE_API_TIMEOUT_MS: "5" })).toThrow(ConfigError);
  });

  it("does not put the token in the URL error message", () => {
    try {
      loadConfig({ WAREHOUSE_API_URL: "nope", WAREHOUSE_API_TOKEN: "s3cret" });
    } catch (error) {
      expect(String(error)).not.toContain("s3cret");
    }
  });
});
