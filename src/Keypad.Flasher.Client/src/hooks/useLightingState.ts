import { useCallback, useMemo, useState } from "react";
import { DEFAULT_BREATHING_MIN_PERCENT, DEFAULT_BREATHING_STEP_MS, DEFAULT_RAINBOW_STEP_MS } from "../components/lightingStyles";
import type { ActiveLedMode, LedColor, LedConfigurationDto, LedPerKeyDto, PassiveLedMode } from "../types";

type LightingCopyBuffer = {
  passiveMode: PassiveLedMode;
  passive: LedColor;
  activeMode: ActiveLedMode;
  activeColor: LedColor;
  rainbowStepMs: number;
  breathingMinPercent: number;
  breathingStepMs: number;
};

type UseLightingStateParams = {
  initialLedConfig?: LedConfigurationDto | null;
};

type LightingStateApi = {
  ledConfig: LedConfigurationDto | null;
  setLedConfig: (config: LedConfigurationDto | null) => void;
  draftLedConfig: LedConfigurationDto | null;
  setDraftLedConfig: (config: LedConfigurationDto | null) => void;
  showGlobalLightingModal: boolean;
  showLightingModal: boolean;
  focusLedIndex: number | null;
  openGlobalLightingModal: (config?: LedConfigurationDto | null) => void;
  closeGlobalLightingModal: () => void;
  saveGlobalLightingModal: () => void;
  openLightingModal: (config: LedConfigurationDto | null, idx: number | null) => void;
  closeLightingModal: () => void;
  saveLightingModal: () => void;
  setFocusLedIndex: (idx: number | null) => void;
  setPassiveColor: (idx: number, color: LedColor) => void;
  setPassiveModeForLed: (idx: number, mode: PassiveLedMode) => void;
  setActiveMode: (idx: number, mode: ActiveLedMode) => void;
  setActiveColor: (idx: number, color: LedColor) => void;
  setBrightnessPercent: (value: number) => void;
  setRainbowStepMs: (idx: number, value: number) => void;
  setBreathingMinPercent: (idx: number, value: number) => void;
  setBreathingStepMs: (idx: number, value: number) => void;
  lightingStatus: string;
  setLightingStatus: (value: string) => void;
  defaultLightingStatus: string;
  copyLedLighting: (idx: number, label: string) => void;
  pasteLedLighting: (idx: number, label: string) => void;
  applyLightingToAll: (sourceIdx: number, label: string) => void;
  copiedLedLighting: LightingCopyBuffer | null;
};

const cloneLedConfig = (config: LedConfigurationDto | null | undefined): LedConfigurationDto | null => {
  if (!config || !Array.isArray(config.leds) || typeof config.brightnessPercent !== "number") {
    return null;
  }

  const cloneLed = (led: LedPerKeyDto): LedPerKeyDto => ({
    passiveMode: led.passiveMode,
    passiveColor: { ...led.passiveColor },
    activeMode: led.activeMode,
    activeColor: { ...led.activeColor },
    rainbowStepMs: led.rainbowStepMs,
    breathingMinPercent: led.breathingMinPercent,
    breathingStepMs: led.breathingStepMs,
  });

  return {
    brightnessPercent: config.brightnessPercent,
    leds: config.leds.map(cloneLed),
  };
};

export function useLightingState(params: UseLightingStateParams = {}): LightingStateApi {
  const defaultLightingStatus = "Copy a key's lighting to paste or apply to all.";
  const [ledConfig, setLedConfig] = useState<LedConfigurationDto | null>(params.initialLedConfig ?? null);
  const [draftLedConfig, setDraftLedConfig] = useState<LedConfigurationDto | null>(null);
  const [showGlobalLightingModal, setShowGlobalLightingModal] = useState<boolean>(false);
  const [showLightingModal, setShowLightingModal] = useState<boolean>(false);
  const [focusLedIndex, setFocusLedIndex] = useState<number | null>(null);
  const [copiedLedLighting, setCopiedLedLighting] = useState<LightingCopyBuffer | null>(null);
  const [lightingStatus, setLightingStatus] = useState<string>(defaultLightingStatus);

  const openGlobalLightingModal = useCallback((config?: LedConfigurationDto | null) => {
    const target = cloneLedConfig(config ?? ledConfig);
    if (!target) return;
    setDraftLedConfig(target);
    setLightingStatus(defaultLightingStatus);
    setFocusLedIndex(null);
    setShowGlobalLightingModal(true);
  }, [defaultLightingStatus, ledConfig]);

  const closeGlobalLightingModal = useCallback(() => {
    setShowGlobalLightingModal(false);
    setDraftLedConfig(null);
  }, []);

  const saveGlobalLightingModal = useCallback(() => {
    if (draftLedConfig) {
      setLedConfig(draftLedConfig);
    }
    closeGlobalLightingModal();
  }, [closeGlobalLightingModal, draftLedConfig]);

  const openLightingModal = useCallback((config: LedConfigurationDto | null, idx: number | null) => {
    const cloned = cloneLedConfig(config);
    if (!cloned) return;
    setDraftLedConfig(cloned);
    setLightingStatus(defaultLightingStatus);
    setFocusLedIndex(idx ?? null);
    setShowLightingModal(true);
  }, [defaultLightingStatus]);

  const closeLightingModal = useCallback(() => {
    setShowLightingModal(false);
    setDraftLedConfig(null);
    setFocusLedIndex(null);
    setLightingStatus(defaultLightingStatus);
  }, [defaultLightingStatus]);

  const saveLightingModal = useCallback(() => {
    if (draftLedConfig) {
      setLedConfig(draftLedConfig);
    }
    closeLightingModal();
  }, [closeLightingModal, draftLedConfig]);

  const updateLed = useCallback((idx: number, updater: (led: LedPerKeyDto) => LedPerKeyDto) => {
    setDraftLedConfig((prev) => {
      if (!prev || idx < 0 || idx >= prev.leds.length) return prev;
      const nextLeds = [...prev.leds];
      nextLeds[idx] = updater(nextLeds[idx]);
      return { ...prev, leds: nextLeds };
    });
  }, []);

  const setPassiveColor = useCallback((idx: number, color: LedColor) => {
    updateLed(idx, (led) => ({ ...led, passiveColor: color }));
  }, [updateLed]);

  const setPassiveModeForLed = useCallback((idx: number, mode: PassiveLedMode) => {
    updateLed(idx, (led) => ({ ...led, passiveMode: mode }));
  }, [updateLed]);

  const setActiveMode = useCallback((idx: number, mode: ActiveLedMode) => {
    updateLed(idx, (led) => ({ ...led, activeMode: mode }));
  }, [updateLed]);

  const setActiveColor = useCallback((idx: number, color: LedColor) => {
    updateLed(idx, (led) => ({ ...led, activeColor: color }));
  }, [updateLed]);

  const setBrightnessPercent = useCallback((value: number) => {
    setDraftLedConfig((prev) => (prev ? { ...prev, brightnessPercent: value } : prev));
  }, []);

  const setRainbowStepMs = useCallback((idx: number, value: number) => {
    updateLed(idx, (led) => ({ ...led, rainbowStepMs: value }));
  }, [updateLed]);

  const setBreathingMinPercent = useCallback((idx: number, value: number) => {
    updateLed(idx, (led) => ({ ...led, breathingMinPercent: value }));
  }, [updateLed]);

  const setBreathingStepMs = useCallback((idx: number, value: number) => {
    updateLed(idx, (led) => ({ ...led, breathingStepMs: value }));
  }, [updateLed]);

  const copyLedLighting = useCallback((idx: number, label: string) => {
    const source = draftLedConfig;
    if (!source || idx < 0 || idx >= source.leds.length) return;
    const led = source.leds[idx];
    setCopiedLedLighting({
      passiveMode: led.passiveMode,
      passive: led.passiveColor,
      activeMode: led.activeMode,
      activeColor: led.activeColor,
      rainbowStepMs: led.rainbowStepMs,
      breathingMinPercent: led.breathingMinPercent,
      breathingStepMs: led.breathingStepMs,
    });
    setLightingStatus(`Copied lighting from ${label}. Paste or apply to all.`);
  }, [draftLedConfig]);

  const pasteLedLighting = useCallback((idx: number, label: string) => {
    setDraftLedConfig((prev) => {
      if (!prev || !copiedLedLighting || idx < 0 || idx >= prev.leds.length) return prev;
      const leds = [...prev.leds];
      leds[idx] = {
        ...leds[idx],
        passiveMode: copiedLedLighting.passiveMode,
        passiveColor: copiedLedLighting.passive,
        activeMode: copiedLedLighting.activeMode,
        activeColor: copiedLedLighting.activeColor,
        rainbowStepMs: copiedLedLighting.rainbowStepMs,
        breathingMinPercent: copiedLedLighting.breathingMinPercent,
        breathingStepMs: copiedLedLighting.breathingStepMs,
      };
      return { ...prev, leds };
    });
    setLightingStatus(`Pasted lighting to ${label}.`);
  }, [copiedLedLighting]);

  const applyLightingToAll = useCallback((sourceIdx: number, label: string) => {
    setDraftLedConfig((prev) => {
      if (!prev || sourceIdx < 0 || sourceIdx >= prev.leds.length) return prev;
      const source = prev.leds[sourceIdx];
      const leds = prev.leds.map(() => ({ ...source }));
      return {
        ...prev,
        leds: leds.map((led) => ({
          ...led,
          passiveColor: { ...source.passiveColor },
          activeColor: { ...source.activeColor },
          rainbowStepMs: source.rainbowStepMs ?? DEFAULT_RAINBOW_STEP_MS,
          breathingMinPercent: source.breathingMinPercent ?? DEFAULT_BREATHING_MIN_PERCENT,
          breathingStepMs: source.breathingStepMs ?? DEFAULT_BREATHING_STEP_MS,
        })),
      };
    });
    setLightingStatus(`Applied lighting from ${label} to all.`);
  }, []);

  return useMemo(() => ({
    ledConfig,
    setLedConfig,
    draftLedConfig,
    setDraftLedConfig,
    showGlobalLightingModal,
    showLightingModal,
    focusLedIndex,
    openGlobalLightingModal,
    closeGlobalLightingModal,
    saveGlobalLightingModal,
    openLightingModal,
    closeLightingModal,
    saveLightingModal,
    setFocusLedIndex,
    setPassiveColor,
    setPassiveModeForLed,
    setActiveMode,
    setActiveColor,
    setBrightnessPercent,
    setRainbowStepMs,
    setBreathingMinPercent,
    setBreathingStepMs,
    lightingStatus,
    setLightingStatus,
    defaultLightingStatus,
    copyLedLighting,
    pasteLedLighting,
    applyLightingToAll,
    copiedLedLighting,
  }), [
    applyLightingToAll,
    closeGlobalLightingModal,
    closeLightingModal,
    copyLedLighting,
    defaultLightingStatus,
    draftLedConfig,
    focusLedIndex,
    ledConfig,
    lightingStatus,
    openGlobalLightingModal,
    openLightingModal,
    pasteLedLighting,
    saveGlobalLightingModal,
    saveLightingModal,
    setActiveColor,
    setActiveMode,
    setBreathingMinPercent,
    setBreathingStepMs,
    setBrightnessPercent,
    setPassiveColor,
    setPassiveModeForLed,
    setRainbowStepMs,
    showGlobalLightingModal,
    showLightingModal,
    copiedLedLighting,
  ]);
}
