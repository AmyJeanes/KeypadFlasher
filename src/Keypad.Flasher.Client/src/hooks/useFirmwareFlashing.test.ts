import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFirmwareFlashing } from "./useFirmwareFlashing";
import { sampleBindings, sampleLayout, sampleLedConfig } from "../test/fixtures";
import type { Status } from "../types";

const { parseIntelHexBrowserMock } = vi.hoisted(() => ({
  parseIntelHexBrowserMock: vi.fn(() => ({ data: new Uint8Array([1, 2, 3]) })),
}));

vi.mock("../lib/ch55xBootloader", () => ({
  parseIntelHexBrowser: parseIntelHexBrowserMock,
}));

describe("useFirmwareFlashing", () => {
  const setStatus = vi.fn<(s: Status) => void>();
  const setProgress = vi.fn();
  const assertLedConfigMatchesLayout = vi.fn((_layout, config) => config);
  const disconnectClient = vi.fn().mockResolvedValue(undefined);

  const mockClient = {
    flashBinary: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("atob", (input: string) => input);
  });

  it("reports unsupported if no layout and debug disabled", async () => {
    const { result } = renderHook(() => useFirmwareFlashing({
      clientRef: { current: mockClient } as never,
      setStatus,
      setProgress,
      assertLedConfigMatchesLayout,
      selectedLayout: null,
      selectedProfile: null,
      currentBindings: null,
      ledConfig: null,
      disconnectClient,
      debugFirmware: false,
      debugOptions: { enableNoiseFilter: true, enablePullups: true, confirmSamples: 3, confirmDelayMs: 1 },
    }));

    await act(async () => {
      await result.current.compileAndFlash();
    });

    expect(setStatus).toHaveBeenCalledWith({ state: "unsupported", detail: "Device not recognized. Use debug firmware or check supported layouts." });
  });

  it("builds debug firmware payload with sanitized options", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ fileBytes: ":00000001FF" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useFirmwareFlashing({
      clientRef: { current: mockClient } as never,
      setStatus,
      setProgress,
      assertLedConfigMatchesLayout,
      selectedLayout: sampleLayout,
      selectedProfile: { name: "x" } as never,
      currentBindings: sampleBindings,
      ledConfig: sampleLedConfig,
      disconnectClient,
      debugFirmware: true,
      debugOptions: { enableNoiseFilter: true, enablePullups: false, confirmSamples: 999, confirmDelayMs: -9 },
    }));

    await act(async () => {
      await result.current.compileAndFlash();
    });

    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(request.debug).toBe(true);
    expect(request.layout).toBeNull();
    expect(request.debugOptions.confirmSamples).toBe(255);
    expect(request.debugOptions.confirmDelayMs).toBe(0);
    expect(mockClient.flashBinary).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), expect.any(Function));
  });

  it("maps compile error responses into status detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error",
      headers: { get: () => "application/json" },
      json: async () => ({ error: "boom", exitCode: 2, stdout: "out", stderr: "err" }),
    }));

    const { result } = renderHook(() => useFirmwareFlashing({
      clientRef: { current: mockClient } as never,
      setStatus,
      setProgress,
      assertLedConfigMatchesLayout,
      selectedLayout: sampleLayout,
      selectedProfile: { name: "x" } as never,
      currentBindings: sampleBindings,
      ledConfig: sampleLedConfig,
      disconnectClient,
      debugFirmware: false,
      debugOptions: { enableNoiseFilter: true, enablePullups: true, confirmSamples: 3, confirmDelayMs: 1 },
    }));

    await act(async () => {
      await result.current.compileAndFlash();
    });

    expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({ state: "compileError" }));
  });

  it("sets fileApiMissing when upload is attempted without File API", () => {
    const { result } = renderHook(() => useFirmwareFlashing({
      clientRef: { current: mockClient } as never,
      setStatus,
      setProgress,
      assertLedConfigMatchesLayout,
      selectedLayout: sampleLayout,
      selectedProfile: null,
      currentBindings: sampleBindings,
      ledConfig: sampleLedConfig,
      disconnectClient,
      debugFirmware: false,
      debugOptions: { enableNoiseFilter: true, enablePullups: true, confirmSamples: 3, confirmDelayMs: 1 },
    }));

    const originalFile = window.File;
    // @ts-expect-error test shim
    window.File = undefined;

    act(() => {
      result.current.handleHexClick();
    });

    expect(setStatus).toHaveBeenCalledWith({ state: "fileApiMissing" });
    window.File = originalFile;
  });
});
