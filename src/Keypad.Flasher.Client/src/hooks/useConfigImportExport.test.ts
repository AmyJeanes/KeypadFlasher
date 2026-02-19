import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useConfigImportExport } from "./useConfigImportExport";
import { bootloaderConfigFromLayout } from "../lib/configValidation";
import { sampleBindings, sampleLayout, sampleLedConfig } from "../test/fixtures";

const saveStoredConfigMock = vi.fn();

vi.mock("../lib/layoutStorage", async () => {
  const actual = await vi.importActual<typeof import("../lib/layoutStorage")>("../lib/layoutStorage");
  return {
    ...actual,
    saveStoredConfig: (...args: unknown[]) => saveStoredConfigMock(...args),
  };
});

describe("useConfigImportExport", () => {
  it("builds export payload and opens modal", () => {
    const setStatus = vi.fn();
    const { result } = renderHook(() => useConfigImportExport({
      currentBindings: sampleBindings,
      selectedLayout: sampleLayout,
      ledConfig: sampleLedConfig,
      selectedProfileName: "Test profile",
      connectedInfo: { id: [1, 2, 3, 4], version: "1.0.0", deviceIdHex: "0x52" },
      rememberedBootloaderId: null,
      lastBootloaderIdRef: { current: null },
      assertLedConfigMatchesLayout: (_layout, config) => config,
      setSelectedLayout: vi.fn(),
      setCurrentBindings: vi.fn(),
      setLedConfig: vi.fn(),
      showToast: vi.fn(),
      setStatus,
    }));

    act(() => result.current.openExportModal());

    expect(result.current.showExportModal).toBe(true);
    expect(result.current.exportText).toContain('"deviceId": [');
    expect(result.current.exportText).toContain('"bootloaderConfig"');
  });

  it("imports compatible config and persists it", () => {
    const setSelectedLayout = vi.fn();
    const setCurrentBindings = vi.fn();
    const setLedConfig = vi.fn();
    const showToast = vi.fn();

    const payload = JSON.stringify({
      version: 1,
      deviceId: [1, 2, 3, 4],
      bindings: sampleBindings,
      bootloaderConfig: bootloaderConfigFromLayout(sampleLayout),
      ledConfig: sampleLedConfig,
    });

    const { result } = renderHook(() => useConfigImportExport({
      currentBindings: sampleBindings,
      selectedLayout: sampleLayout,
      ledConfig: sampleLedConfig,
      selectedProfileName: "Test profile",
      connectedInfo: { id: [1, 2, 3, 4], version: "1.0.0", deviceIdHex: "0x52" },
      rememberedBootloaderId: null,
      lastBootloaderIdRef: { current: null },
      assertLedConfigMatchesLayout: (_layout, config) => config,
      setSelectedLayout,
      setCurrentBindings,
      setLedConfig,
      showToast,
      setStatus: vi.fn(),
    }));

    act(() => result.current.applyImportedConfig(payload));

    expect(setCurrentBindings).toHaveBeenCalled();
    expect(setSelectedLayout).toHaveBeenCalled();
    expect(setLedConfig).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Configuration imported", "success", 20000);
    expect(saveStoredConfigMock).toHaveBeenCalled();
  });

  it("rejects import for a different device id", () => {
    const { result } = renderHook(() => useConfigImportExport({
      currentBindings: sampleBindings,
      selectedLayout: sampleLayout,
      ledConfig: sampleLedConfig,
      selectedProfileName: "Test profile",
      connectedInfo: { id: [1, 2, 3, 4], version: "1.0.0", deviceIdHex: "0x52" },
      rememberedBootloaderId: null,
      lastBootloaderIdRef: { current: null },
      assertLedConfigMatchesLayout: (_layout, config) => config,
      setSelectedLayout: vi.fn(),
      setCurrentBindings: vi.fn(),
      setLedConfig: vi.fn(),
      showToast: vi.fn(),
      setStatus: vi.fn(),
    }));

    act(() => result.current.applyImportedConfig(JSON.stringify({ version: 1, deviceId: [9, 9, 9, 9], bindings: sampleBindings, bootloaderConfig: bootloaderConfigFromLayout(sampleLayout) })));

    expect(result.current.importError).toMatch(/different device/i);
  });
});
