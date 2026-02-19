import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useModalClosing } from "./useModalClosing";

describe("useModalClosing", () => {
  it("enters closing state and calls onClosed after both animations finish", () => {
    const onClosed = vi.fn();
    const { result } = renderHook(() => useModalClosing(true, onClosed));

    act(() => result.current.requestClose());
    expect(result.current.isClosing).toBe(true);

    act(() => result.current.handleAnimationEnd("modal-pop-out"));
    expect(onClosed).not.toHaveBeenCalled();

    act(() => result.current.handleAnimationEnd("backdrop-fade-out"));
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(result.current.isClosing).toBe(false);
  });

  it("ignores unrelated animation names", () => {
    const onClosed = vi.fn();
    const { result } = renderHook(() => useModalClosing(true, onClosed));

    act(() => result.current.requestClose());
    act(() => result.current.handleAnimationEnd("other"));

    expect(onClosed).not.toHaveBeenCalled();
    expect(result.current.isClosing).toBe(true);
  });
});
