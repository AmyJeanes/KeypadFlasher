import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConfigPersistence } from "./useConfigPersistence";
import type { ConnectedInfo } from "../lib/ch55xBootloader";
import type { KnownDeviceProfile } from "../lib/keypadConfigs";
import { sampleBindings, sampleLayout, sampleLedConfig } from "../test/fixtures";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const mocks = vi.hoisted(() => ({
  loadLastBootloaderId: vi.fn<() => number[] | null>(),
  loadStoredConfig: vi.fn(),
  saveLastBootloaderId: vi.fn(),
  saveStoredConfig: vi.fn(),
  clearStoredConfig: vi.fn(),
  cloneLayout: vi.fn((layout) => clone(layout)),
  findProfileForBootloaderId: vi.fn(),
}));

vi.mock("../lib/layoutStorage", () => ({
  loadLastBootloaderId: mocks.loadLastBootloaderId,
  loadStoredConfig: mocks.loadStoredConfig,
  saveLastBootloaderId: mocks.saveLastBootloaderId,
  saveStoredConfig: mocks.saveStoredConfig,
  clearStoredConfig: mocks.clearStoredConfig,
  cloneLayout: mocks.cloneLayout,
}));

vi.mock("../lib/keypadConfigs", async () => {
  const actual = await vi.importActual<typeof import("../lib/keypadConfigs")>("../lib/keypadConfigs");
  return {
    ...actual,
    findProfileForBootloaderId: mocks.findProfileForBootloaderId,
  };
});

describe("useConfigPersistence (additional coverage)", () => {
  const profile: KnownDeviceProfile = {
    name: "Profile A",
    bootloaderIds: ["1-2-3-4"],
    layout: clone(sampleLayout),
    defaultBindings: clone(sampleBindings),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cloneLayout.mockImplementation((layout) => clone(layout));
  });

  it("hydrates profile and stored config from remembered bootloader id on mount", async () => {
    const storedLayout = clone(sampleLayout);
    storedLayout.buttons[0].bootloaderOnBoot = false;
    const storedBindings = clone(sampleBindings);
    storedBindings.buttons[0].binding = { type: "Sequence", steps: [{ kind: "Pause", gapMs: 333 }] };

    mocks.loadLastBootloaderId.mockReturnValue([1, 2, 3, 4]);
    mocks.findProfileForBootloaderId.mockReturnValue(profile);
    mocks.loadStoredConfig.mockReturnValue({
      layout: storedLayout,
      bindings: storedBindings,
      ledConfig: clone(sampleLedConfig),
    });

    const setSelectedProfile = vi.fn();
    const setSelectedLayout = vi.fn();
    const setCurrentBindings = vi.fn();
    const setLedConfig = vi.fn();

    renderHook(() => useConfigPersistence({
      currentBindings: null,
      selectedLayout: null,
      setSelectedProfile,
      setSelectedLayout,
      setCurrentBindings,
      setLedConfig,
      pickLedConfigForLayout: (_layout, config) => config,
      assertLedConfigMatchesLayout: (_layout, config) => config,
      showToast: vi.fn(),
      setStatus: vi.fn(),
      connectedInfo: null,
      ledConfig: null,
      demoMode: false,
    }));

    await waitFor(() => {
      expect(setSelectedProfile).toHaveBeenCalledWith(profile);
      expect(setSelectedLayout).toHaveBeenCalledWith(storedLayout);
      expect(setCurrentBindings).toHaveBeenCalledWith(storedBindings);
      expect(setLedConfig).toHaveBeenCalledWith(sampleLedConfig);
    });
  });

  it("keeps existing layout and bindings when reconnecting to the same device", () => {
    mocks.loadLastBootloaderId.mockReturnValue(null);
    mocks.findProfileForBootloaderId.mockReturnValue(profile);
    mocks.loadStoredConfig.mockReturnValue({
      layout: clone(sampleLayout),
      bindings: clone(sampleBindings),
      ledConfig: clone(sampleLedConfig),
    });

    const setSelectedProfile = vi.fn();
    const setSelectedLayout = vi.fn();
    const setCurrentBindings = vi.fn();
    const setLedConfig = vi.fn();
    const setStatus = vi.fn();

    const { result } = renderHook(() => useConfigPersistence({
      currentBindings: clone(sampleBindings),
      selectedLayout: clone(sampleLayout),
      setSelectedProfile,
      setSelectedLayout,
      setCurrentBindings,
      setLedConfig,
      pickLedConfigForLayout: (_layout, config) => config,
      assertLedConfigMatchesLayout: (_layout, config) => config,
      showToast: vi.fn(),
      setStatus,
      connectedInfo: null,
      ledConfig: clone(sampleLedConfig),
      demoMode: false,
    }));

    setSelectedLayout.mockClear();
    setCurrentBindings.mockClear();

    const info: ConnectedInfo = { id: [1, 2, 3, 4], version: "1.0.0", deviceIdHex: "0x52" };

    act(() => {
      result.current.lastBootloaderIdRef.current = [1, 2, 3, 4];
      result.current.applyConnectedDevice(info, { source: "real", persistLastId: true });
    });

    expect(setSelectedLayout).not.toHaveBeenCalled();
    expect(setCurrentBindings).not.toHaveBeenCalled();
    expect(mocks.saveLastBootloaderId).toHaveBeenCalledWith([1, 2, 3, 4]);
    expect(setStatus).toHaveBeenCalledWith({ state: "connectedKnown", detail: "Profile A" });
    expect(setLedConfig).toHaveBeenCalled();
  });

  it("clears state when restoring without any remembered id", () => {
    mocks.loadLastBootloaderId.mockReturnValue(null);

    const setSelectedProfile = vi.fn();
    const setSelectedLayout = vi.fn();
    const setCurrentBindings = vi.fn();
    const setLedConfig = vi.fn();

    const { result } = renderHook(() => useConfigPersistence({
      currentBindings: clone(sampleBindings),
      selectedLayout: clone(sampleLayout),
      setSelectedProfile,
      setSelectedLayout,
      setCurrentBindings,
      setLedConfig,
      pickLedConfigForLayout: (_layout, config) => config,
      assertLedConfigMatchesLayout: (_layout, config) => config,
      showToast: vi.fn(),
      setStatus: vi.fn(),
      connectedInfo: null,
      ledConfig: clone(sampleLedConfig),
      demoMode: false,
    }));

    act(() => {
      result.current.setRememberedBootloaderId(null);
      result.current.lastBootloaderIdRef.current = null;
      result.current.restoreSavedConfig();
    });

    expect(setSelectedProfile).toHaveBeenCalledWith(null);
    expect(setSelectedLayout).toHaveBeenCalledWith(null);
    expect(setCurrentBindings).toHaveBeenCalledWith(null);
    expect(setLedConfig).toHaveBeenCalledWith(null);
  });
});
