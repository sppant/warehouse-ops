import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { allFlagsOff } from "../config/flags.js";
import { expectConformsToSpec, uncoveredOperations } from "../openapi/contract.js";

describe("contract: Config", () => {
  afterAll(() => {
    expect(uncoveredOperations("Config")).toEqual([]);
  });

  it("GET /api/config/flags reports every flag off by default", async () => {
    const app = buildApp({ flags: allFlagsOff() });
    const response = await app.inject({ method: "GET", url: "/api/config/flags" });

    expect(response.statusCode).toBe(200);
    expect(expectConformsToSpec(response, "get", "/api/config/flags")).toEqual({
      data: { movementsCsvExport: false },
    });

    await app.close();
  });

  it("GET /api/config/flags reports a flag that is on", async () => {
    const app = buildApp({ flags: { movementsCsvExport: true } });
    const response = await app.inject({ method: "GET", url: "/api/config/flags" });

    expect(expectConformsToSpec(response, "get", "/api/config/flags")).toEqual({
      data: { movementsCsvExport: true },
    });

    await app.close();
  });
});
