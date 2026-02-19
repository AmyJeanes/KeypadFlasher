import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConnectionFlow } from "./useConnectionFlow";
import type { Status } from "../types";

const saveConnectWizardHiddenMock = vi.fn();

vi.mock("../lib/layoutStorage", () => ({
  loadConnectWizardHidden: () => false,
  saveConnectWizardHidden: (...args: unknown[]) => saveConnectWizardHiddenMock(...args),
}));

describe("useConnectionFlow", () => {
  beforeEach(() => {
    saveConnectWizardHiddenMock.mockClear();
  });

  it("opens connect wizard when wizard is not hidden", () => {
    const performConnect = vi.fn().mockResolvedValue(undefined);
    const status: Status = { state: "idle" };

    const { result } = renderHook(({ currentStatus }) => useConnectionFlow({ status: currentStatus, performConnect }), {
      initialProps: { currentStatus: status },
    });

    act(() => result.current.handleConnectClick());
    expect(result.current.showConnectWizard).toBe(true);
    expect(performConnect).not.toHaveBeenCalled();
  });

  it("connects directly when wizard is hidden", () => {
    const performConnect = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useConnectionFlow({ status: { state: "idle" }, performConnect }));

    act(() => result.current.updateWizardHidden(true));
    act(() => result.current.handleConnectClick());

    expect(performConnect).toHaveBeenCalledTimes(1);
    expect(saveConnectWizardHiddenMock).toHaveBeenCalledWith(true);
  });

  it("auto-hides wizard after successful connection status", () => {
    const performConnect = vi.fn().mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ currentStatus }) => useConnectionFlow({ status: currentStatus, performConnect }),
      { initialProps: { currentStatus: { state: "idle" } as Status } },
    );

    rerender({ currentStatus: { state: "connectedKnown" } });

    expect(result.current.wizardHidden).toBe(true);
    expect(saveConnectWizardHiddenMock).toHaveBeenCalledWith(true);
  });
});
