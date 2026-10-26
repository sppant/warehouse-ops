import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("only updates after the value has been stable for the delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "ab" });
    act(() => void vi.advanceTimersByTime(200));
    rerender({ value: "abc" });
    act(() => void vi.advanceTimersByTime(200));
    expect(result.current).toBe("a");

    act(() => void vi.advanceTimersByTime(100));
    expect(result.current).toBe("abc");
  });
});
