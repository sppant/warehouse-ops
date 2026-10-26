import { describe, expect, it, vi } from "vitest";
import { ApiRequestError, createApiClient } from "./api-client.js";
import type { Config } from "./config.js";

const config: Config = {
  apiUrl: "http://api.test",
  apiToken: "s3cret-token",
  timeoutMs: 1000,
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("createApiClient", () => {
  it("builds the URL, skips undefined params and sends the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { data: [] }));
    const client = createApiClient(config, fetchMock);

    await client.get("/api/x", { a: "1", b: undefined, c: 2 });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://api.test/api/x?a=1&c=2");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer s3cret-token");
  });

  it("omits Authorization when no token is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, {}));
    await createApiClient({ ...config, apiToken: undefined }, fetchMock).get("/x");

    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBeUndefined();
  });

  it.each([
    [400, { error: "Invalid inventory overview query", details: { a: 1 } }, "rejected the request"],
    [401, { error: "x" }, "WAREHOUSE_API_TOKEN"],
    [404, { error: "Product not found" }, "Product not found"],
    [500, { error: "boom" }, "(500)"],
  ])("maps HTTP %i to a clear error", async (status, body, expected) => {
    const client = createApiClient(config, vi.fn().mockResolvedValue(json(status, body)));

    await expect(client.get("/x")).rejects.toThrow(expected);
    await expect(client.get("/x")).rejects.toBeInstanceOf(ApiRequestError);
  });

  it("explains network failures and never leaks the token", async () => {
    const client = createApiClient(
      config,
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );

    const error = await client.get("/x").catch((e: Error) => e);

    expect((error as Error).message).toContain("Could not reach");
    expect((error as Error).message).not.toContain("s3cret-token");
  });

  it("reports timeouts", async () => {
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    const client = createApiClient(config, vi.fn().mockRejectedValue(timeout));

    await expect(client.get("/x")).rejects.toThrow("did not answer within 1000 ms");
  });

  it("rejects non-JSON success responses", async () => {
    const client = createApiClient(
      config,
      vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })),
    );

    await expect(client.get("/x")).rejects.toThrow("not valid JSON");
  });
});
