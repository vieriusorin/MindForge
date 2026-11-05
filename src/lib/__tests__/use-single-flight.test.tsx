import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSingleFlight } from "../use-single-flight";

describe("useSingleFlight", () => {
  it("lets the first start through and refuses a second until released", () => {
    const { result } = renderHook(() => useSingleFlight());

    expect(result.current.tryStart()).toBe(true);
    expect(result.current.tryStart()).toBe(false);

    result.current.release();
    expect(result.current.tryStart()).toBe(true);
  });

  it("keeps the flight across re-renders (a ref, not render state)", () => {
    const { result, rerender } = renderHook(() => useSingleFlight());

    expect(result.current.tryStart()).toBe(true);
    rerender();
    expect(result.current.tryStart()).toBe(false);
  });

  it("release from an earlier render's closure still frees the flight", () => {
    const { result, rerender } = renderHook(() => useSingleFlight());
    const { release } = result.current;

    result.current.tryStart();
    rerender();
    release();
    expect(result.current.tryStart()).toBe(true);
  });
});
