import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBootloaderConnection } from "./useBootloaderConnection";
import type { Status } from "../types";

const mocks = vi.hoisted(() => ({
  isWebUsbAvailable: vi.fn(() => true),
  connect: vi.fn(async () => ({ id: [1, 2, 3, 4], version: "1.0.0", deviceIdHex: "0x52" })),
  disconnect: vi.fn(async () => {}),
  ping: vi.fn(async () => {}),
  runApplication: vi.fn(async () => {}),
  normalizeUsbErrorMessage: vi.fn((value: string) => value),
  fakeConnect: vi.fn(async () => ({ id: [9, 9, 9, 9], version: "demo", deviceIdHex: "0x52" })),
  fakeDisconnect: vi.fn(async () => {}),
}));

vi.mock("../lib/ch55xBootloader", () => {
  class MockBootloader {
    static isWebUsbAvailable = mocks.isWebUsbAvailable;
    connect = mocks.connect;
    disconnect = mocks.disconnect;
    flashBinary = vi.fn(async () => {});
    getConnectedDevice = vi.fn(() => null);
    ping = mocks.ping;
    runApplication = mocks.runApplication;
  }

  class MockFakeBootloader {
    constructor(_params: unknown) {}
    connect = mocks.fakeConnect;
    disconnect = mocks.fakeDisconnect;
    flashBinary = vi.fn(async () => {});
    getConnectedDevice = vi.fn(() => null);
    ping = vi.fn(async () => {});
    runApplication = vi.fn(async () => {});
  }

  return {
    CH55xBootloader: MockBootloader,
    FakeBootloader: MockFakeBootloader,
    normalizeUsbErrorMessage: mocks.normalizeUsbErrorMessage,
  };
});

function createParams(overrides: Partial<Parameters<typeof useBootloaderConnection>[0]> = {}) {
  return {
    status: { state: "idle" } as Status,
    setStatus: vi.fn(),
    applyConnectedDevice: vi.fn(),
    restoreSavedConfig: vi.fn(),
    connectedInfo: null,
    setConnectedInfo: vi.fn(),
    demoMode: false,
    setDemoMode: vi.fn(),
    onDisconnected: vi.fn(),
    ...overrides,
  };
}

describe("useBootloaderConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isWebUsbAvailable.mockReturnValue(true);
    mocks.normalizeUsbErrorMessage.mockImplementation((value: string) => value);
  });

  it("sets an error when WebUSB is unavailable", async () => {
    mocks.isWebUsbAvailable.mockReturnValue(false);
    const params = createParams();

    const { result } = renderHook(() => useBootloaderConnection(params));

    await act(async () => {
      await result.current.performConnect();
    });

    expect(params.setStatus).toHaveBeenCalledWith({ state: "error", detail: "WebUSB not available in this browser." });
  });

  it("shows wizard prompt instead of error for direct no-device selection when wizard is hidden", async () => {
    mocks.connect.mockRejectedValueOnce(new Error("No device selected"));
    const params = createParams();
    const onShowWizardPrompt = vi.fn();

    const { result } = renderHook(() => useBootloaderConnection(params));

    await act(async () => {
      await result.current.performConnect({ origin: "direct", wizardHidden: true, onShowWizardPrompt });
    });

    expect(onShowWizardPrompt).toHaveBeenCalledTimes(1);
    expect(params.setStatus).toHaveBeenCalledWith({ state: "idle" });
  });

  it("propagates normalized errors for wizard-origin connect failures", async () => {
    mocks.connect.mockRejectedValueOnce(new Error("raw failure"));
    mocks.normalizeUsbErrorMessage.mockReturnValueOnce("Normalized failure");
    const params = createParams();

    const { result } = renderHook(() => useBootloaderConnection(params));

    await expect(result.current.performConnect({ origin: "wizard" })).rejects.toThrow("Normalized failure");
    expect(params.setStatus).toHaveBeenCalledWith({ state: "error", detail: "Normalized failure" });
  });

  it("disconnects client, restores config, and sets idle status", async () => {
    const params = createParams();
    const { result } = renderHook(() => useBootloaderConnection(params));

    result.current.clientRef.current = {
      connect: async () => ({ id: [1, 2, 3, 4], version: "1.0.0", deviceIdHex: "0x52" }),
      disconnect: mocks.disconnect,
      flashBinary: async () => {},
      getConnectedDevice: () => null,
      ping: async () => {},
      runApplication: mocks.runApplication,
    };

    await act(async () => {
      await result.current.handleDisconnect(true);
    });

    expect(mocks.runApplication).toHaveBeenCalledTimes(1);
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    expect(params.setDemoMode).toHaveBeenCalledWith(false);
    expect(params.setConnectedInfo).toHaveBeenCalledWith(null);
    expect(params.restoreSavedConfig).toHaveBeenCalledTimes(1);
    expect(params.setStatus).toHaveBeenCalledWith({ state: "idle" });
  });
});
