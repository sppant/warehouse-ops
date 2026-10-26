import { afterEach, describe, expect, it, vi } from "vitest";
import { allFlagsOff, parseFeatureFlags, readFeatureFlags } from "./flags.js";

describe("parseFeatureFlags", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("has every flag off when nothing is set", () => {
    expect(parseFeatureFlags(undefined)).toEqual(allFlagsOff());
    expect(parseFeatureFlags("")).toEqual(allFlagsOff());
    expect(allFlagsOff()).toEqual({ movementsCsvExport: false });
  });

  it("turns on the flags that are listed", () => {
    expect(parseFeatureFlags("movementsCsvExport")).toEqual({ movementsCsvExport: true });
    expect(parseFeatureFlags(" , movementsCsvExport ,")).toEqual({ movementsCsvExport: true });
  });

  it("ignores unknown names and warns, leaving flags off", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(parseFeatureFlags("movementscsvexport,nope")).toEqual(allFlagsOff());
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("reads FEATURE_FLAGS from the environment", () => {
    expect(readFeatureFlags({ FEATURE_FLAGS: "movementsCsvExport" }).movementsCsvExport).toBe(true);
    expect(readFeatureFlags({}).movementsCsvExport).toBe(false);
  });
});
