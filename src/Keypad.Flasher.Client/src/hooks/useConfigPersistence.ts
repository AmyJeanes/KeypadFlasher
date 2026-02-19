import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { sameBootloaderId } from "../lib/configValidation";
import { clearStoredConfig, cloneLayout, loadLastBootloaderId, loadStoredConfig, saveLastBootloaderId, saveStoredConfig } from "../lib/layoutStorage";
import { findProfileForBootloaderId } from "../lib/keypadConfigs";
import type { ConnectedInfo } from "../lib/ch55xBootloader";
import type { BindingProfileDto, DeviceLayoutDto, KnownDeviceProfile } from "../lib/keypadConfigs";
import type { LedConfigurationDto, Status } from "../types";

type ToastTone = "info" | "success" | "warn" | "error";

type ApplyDeviceOptions = { source: "real" | "demo"; persistLastId: boolean };

type UseConfigPersistenceParams = {
  currentBindings: BindingProfileDto | null;
  selectedLayout: DeviceLayoutDto | null;
  setSelectedProfile: (profile: KnownDeviceProfile | null) => void;
  setSelectedLayout: (layout: DeviceLayoutDto | null) => void;
  setCurrentBindings: (bindings: BindingProfileDto | null) => void;
  setLedConfig: (config: LedConfigurationDto | null) => void;
  pickLedConfigForLayout: (layout: DeviceLayoutDto | null, config: LedConfigurationDto | null) => LedConfigurationDto | null;
  assertLedConfigMatchesLayout: (layout: DeviceLayoutDto | null, config: LedConfigurationDto | null) => LedConfigurationDto | null;
  showToast: (message: string, tone?: ToastTone, durationMs?: number) => void;
  setStatus: (status: Status) => void;
  connectedInfo: ConnectedInfo | null;
  ledConfig: LedConfigurationDto | null;
  demoMode: boolean;
};

type UseConfigPersistenceResult = {
  rememberedBootloaderId: number[] | null;
  setRememberedBootloaderId: (id: number[] | null) => void;
  lastBootloaderIdRef: MutableRefObject<number[] | null>;
  applyConnectedDevice: (info: ConnectedInfo, options: ApplyDeviceOptions) => void;
  restoreSavedConfig: () => void;
};

export function useConfigPersistence(params: UseConfigPersistenceParams): UseConfigPersistenceResult {
  const {
    currentBindings,
    selectedLayout,
    setSelectedProfile,
    setSelectedLayout,
    setCurrentBindings,
    setLedConfig,
    pickLedConfigForLayout,
    assertLedConfigMatchesLayout,
    showToast,
    setStatus,
    connectedInfo,
    ledConfig,
    demoMode,
  } = params;

  const [rememberedBootloaderId, setRememberedBootloaderId] = useState<number[] | null>(null);
  const lastBootloaderIdRef = useRef<number[] | null>(null);

  useEffect(() => {
    const lastId = loadLastBootloaderId();
    if (!lastId) return;
    setRememberedBootloaderId(lastId);
    const profile = findProfileForBootloaderId(lastId);
    setSelectedProfile(profile);
    const stored = loadStoredConfig(lastId);
    const nextLayout = stored?.layout ?? (profile?.layout ? cloneLayout(profile.layout) : null);
    const nextBindings = stored?.bindings ?? profile?.defaultBindings ?? null;
    try {
      const pickedLedConfig = pickLedConfigForLayout(nextLayout, stored?.ledConfig ?? null);
      const validatedLedConfig = assertLedConfigMatchesLayout(nextLayout, pickedLedConfig);
      setSelectedLayout(nextLayout);
      setCurrentBindings(nextBindings);
      setLedConfig(validatedLedConfig);
    } catch (err) {
      clearStoredConfig(lastId);
      const fallbackLayout = profile?.layout ? cloneLayout(profile.layout) : null;
      const fallbackBindings = profile?.defaultBindings ?? null;
      const pickedLedConfig = pickLedConfigForLayout(fallbackLayout, null);
      const validatedLedConfig = assertLedConfigMatchesLayout(fallbackLayout, pickedLedConfig);
      setSelectedLayout(fallbackLayout);
      setCurrentBindings(fallbackBindings);
      setLedConfig(validatedLedConfig);
      showToast("Saved configuration was invalid and has been reset.", "warn", 5200);
      setStatus({ state: "idle" });
    }
  }, [assertLedConfigMatchesLayout, pickLedConfigForLayout, setCurrentBindings, setLedConfig, setSelectedLayout, setSelectedProfile, showToast, setStatus]);

  const applyConnectedDevice = useCallback((info: ConnectedInfo, options: ApplyDeviceOptions) => {
    const previousId = lastBootloaderIdRef.current;
    const sameDevice = sameBootloaderId(previousId, info.id);

    if (options.persistLastId) {
      lastBootloaderIdRef.current = info.id;
    }

    const profile = findProfileForBootloaderId(info.id);
    setSelectedProfile(profile);

    if (options.persistLastId) {
      setRememberedBootloaderId(info.id);
      saveLastBootloaderId(info.id);
    }

    const stored = loadStoredConfig(info.id);
    try {
      const loadedLayout = stored?.layout ?? (profile?.layout ? cloneLayout(profile.layout) : null);
      const loadedBindings = stored?.bindings ?? profile?.defaultBindings ?? null;
      const nextLayout = (!sameDevice || !selectedLayout) ? loadedLayout : selectedLayout;
      if (!sameDevice || !selectedLayout) {
        setSelectedLayout(loadedLayout);
      }
      if (!sameDevice || !currentBindings) {
        setCurrentBindings(loadedBindings);
      }
      const pickedLedConfig = pickLedConfigForLayout(nextLayout, stored?.ledConfig ?? null);
      const validatedLedConfig = assertLedConfigMatchesLayout(nextLayout, pickedLedConfig);
      setLedConfig(validatedLedConfig);
    } catch (err) {
      clearStoredConfig(info.id);
      const fallbackLayout = profile?.layout ? cloneLayout(profile.layout) : null;
      const fallbackBindings = profile?.defaultBindings ?? null;
      const nextLayout = fallbackLayout;
      setSelectedLayout(fallbackLayout);
      setCurrentBindings(fallbackBindings);
      const pickedLedConfig = pickLedConfigForLayout(nextLayout, null);
      const validatedLedConfig = assertLedConfigMatchesLayout(nextLayout, pickedLedConfig);
      setLedConfig(validatedLedConfig);
      showToast("Saved configuration was invalid and has been reset.", "warn", 5200);
      setStatus({ state: "idle" });
    }

    const detail = profile
      ? `${options.source === "demo" ? "Demo: " : ""}${profile.name}`
      : (options.source === "demo" ? "Demo device" : undefined);
    setStatus(profile ? { state: "connectedKnown", detail } : { state: "connectedUnknown", detail });
  }, [assertLedConfigMatchesLayout, currentBindings, pickLedConfigForLayout, selectedLayout, setCurrentBindings, setLedConfig, setSelectedLayout, setSelectedProfile, setStatus, showToast]);

  const restoreSavedConfig = useCallback(() => {
    const id = rememberedBootloaderId ?? lastBootloaderIdRef.current;
    if (!id) {
      setSelectedProfile(null);
      setSelectedLayout(null);
      setCurrentBindings(null);
      setLedConfig(null);
      return;
    }
    const profile = findProfileForBootloaderId(id);
    setSelectedProfile(profile);
    const stored = loadStoredConfig(id);
    const nextLayout = stored?.layout ?? (profile?.layout ? cloneLayout(profile.layout) : null);
    const nextBindings = stored?.bindings ?? profile?.defaultBindings ?? null;
    try {
      const pickedLedConfig = pickLedConfigForLayout(nextLayout, stored?.ledConfig ?? null);
      const validatedLedConfig = assertLedConfigMatchesLayout(nextLayout, pickedLedConfig);
      setSelectedLayout(nextLayout);
      setCurrentBindings(nextBindings);
      setLedConfig(validatedLedConfig);
    } catch (err) {
      clearStoredConfig(id);
      const fallbackLayout = profile?.layout ? cloneLayout(profile.layout) : null;
      const fallbackBindings = profile?.defaultBindings ?? null;
      const pickedLedConfig = pickLedConfigForLayout(fallbackLayout, null);
      const validatedLedConfig = assertLedConfigMatchesLayout(fallbackLayout, pickedLedConfig);
      setSelectedLayout(fallbackLayout);
      setCurrentBindings(fallbackBindings);
      setLedConfig(validatedLedConfig);
      showToast("Saved configuration was invalid and has been reset.", "warn", 5200);
      setStatus({ state: "idle" });
    }
  }, [assertLedConfigMatchesLayout, pickLedConfigForLayout, rememberedBootloaderId, setCurrentBindings, setLedConfig, setSelectedLayout, setSelectedProfile, setStatus, showToast]);

  useEffect(() => {
    if (demoMode) return;
    const targetId = connectedInfo?.id ?? rememberedBootloaderId ?? lastBootloaderIdRef.current;
    if (!targetId) return;
    saveStoredConfig(targetId, { bindings: currentBindings, layout: selectedLayout, ledConfig });
  }, [connectedInfo, rememberedBootloaderId, currentBindings, selectedLayout, ledConfig, demoMode]);

  return {
    rememberedBootloaderId,
    setRememberedBootloaderId,
    lastBootloaderIdRef,
    applyConnectedDevice,
    restoreSavedConfig,
  };
}
