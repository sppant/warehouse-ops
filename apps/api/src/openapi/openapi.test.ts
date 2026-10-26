import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("openapi.json", () => {
  const committed = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../openapi.json", import.meta.url)), "utf8"),
  );

  it("is served at /api/openapi.json and equals the committed file", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/api/openapi.json" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(committed);

    await app.close();
  });

  it("documents each operation once, with a tag and at least one response", () => {
    const operations = Object.values<Record<string, any>>(committed.paths).flatMap(Object.values);

    expect(operations.length).toBeGreaterThan(30);

    for (const operation of operations) {
      expect(operation.tags).toHaveLength(1);
      expect(Object.keys(operation.responses).length).toBeGreaterThan(0);
    }
  });
});
