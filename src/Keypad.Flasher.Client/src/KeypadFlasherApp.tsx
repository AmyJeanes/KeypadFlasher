/// <reference types="w3c-web-usb" />
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { type ConnectedInfo, type Progress } from "./lib/ch55xBootloader";
import {
  DEVICE_PROFILES,
  type BindingProfileDto,
  type DeviceLayoutDto,
  type HidBindingDto,
  type HidStepDto,
  type KnownDeviceProfile,
} from "./lib/keypadConfigs";
import { cloneLayout, loadConnectWizardHidden, loadLastDemoKey, saveConnectWizardHidden, saveLastDemoKey, saveStoredConfig } from "./lib/layoutStorage";
import { LayoutPreview } from "./components/LayoutPreview";
import { LightingPreview } from "./components/LightingPreview";
import { DEFAULT_BREATHING_MIN_PERCENT, DEFAULT_BREATHING_STEP_MS, DEFAULT_RAINBOW_STEP_MS } from "./components/lightingStyles";
import { ConnectSpinner } from "./components/ConnectSpinner";
import { StatusBanner } from "./components/StatusBanner";
import { StepEditor } from "./components/StepEditor";
import { ConnectWizard } from "./components/ConnectWizard";
import { ConnectWizardPrompt } from "./components/ConnectWizardPrompt";
import { useModalClosing } from "./hooks/useModalClosing";
import { useBootloaderConnection } from "./hooks/useBootloaderConnection";
import { useConfigPersistence } from "./hooks/useConfigPersistence";
import { useFirmwareFlashing, type DebugOptions as DebugOptionsDto } from "./hooks/useFirmwareFlashing";
import { useConfigImportExport } from "./hooks/useConfigImportExport";
import { useLightingState } from "./hooks/useLightingState";
import type { EditTarget, LedConfigurationDto, LedColor, PassiveLedMode, ActiveLedMode, Status, LedPerKeyDto } from "./types";
import "./styles/base.css";


type Toast = { message: string; tone: "info" | "success" | "warn" | "error" };

function validateFixedRows(rows: number[], buttonCount: number): { rows: number[]; error: string | null } {
  const total = rows.reduce((sum, n) => sum + n, 0);
  if (total === buttonCount) return { rows, error: null };
  const fallback = buttonCount > 0 ? [buttonCount] : [];
  return {
    rows: fallback,
    error: `Layout rows total ${total}, expected ${buttonCount}. Falling back to single-row preview.`,
  };
}

export default function KeypadFlasherApp() {
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [progress, setProgress] = useState<Progress>({ phase: "", current: 0, total: 0 });
  const [connectedInfo, setConnectedInfo] = useState<ConnectedInfo | null>(null);
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [selectedProfile, setSelectedProfile] = useState<KnownDeviceProfile | null>(null);
  const [currentBindings, setCurrentBindings] = useState<BindingProfileDto | null>(null);
  const [selectedLayout, setSelectedLayout] = useState<DeviceLayoutDto | null>(null);
  const [editorTarget, setEditorTarget] = useState<EditTarget | null>(null);
  const [editorBinding, setEditorBinding] = useState<HidBindingDto | null>(null);
  const [stepClipboard, setStepClipboard] = useState<HidStepDto[] | null>(null);
  const [showDemoModal, setShowDemoModal] = useState<boolean>(false);
  const [lastDemoKey, setLastDemoKey] = useState<string | null>(() => loadLastDemoKey());
  const [selectedDemoKey, setSelectedDemoKey] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [devMode, setDevMode] = useState<boolean>(false);
  const [debugFirmware, setDebugFirmware] = useState<boolean>(false);
  const defaultDebugOptions: DebugOptionsDto = { enableNoiseFilter: true, enablePullups: true, confirmSamples: 3, confirmDelayMs: 1 };
  const classicDebugOptions: DebugOptionsDto = { enableNoiseFilter: false, enablePullups: false, confirmSamples: 1, confirmDelayMs: 0 };
  const [debugOptions, setDebugOptions] = useState<DebugOptionsDto>(defaultDebugOptions);
  const [wizardHidden, setWizardHidden] = useState<boolean>(() => loadConnectWizardHidden());
  const [showWizardPrompt, setShowWizardPrompt] = useState<boolean>(false);
  const [connectSpinnerOpen, setConnectSpinnerOpen] = useState<boolean>(false);
  const [showConnectWizard, setShowConnectWizard] = useState<boolean>(false);
  const modalPointerDownRef = useRef<boolean>(false);
  const toastTimerRef = useRef<number | null>(null);
  const renderLightingBody = () => {
    if (layoutLedCount === 0 || !draftLedConfig)
    {
      return <div className="muted small">This layout has no LEDs mapped.</div>;
    }

    const target = focusLedIndex != null ? focusLedIndex : 0;
    const activeConfig = draftLedConfig;
    const modalLedCount = activeConfig?.leds.length ?? 0;
    if (target < 0 || target >= modalLedCount)
    {
      return <div className="muted small">LED out of range.</div>;
    }

    const targetLed = activeConfig.leds[target];
    const passiveMode = targetLed.passiveMode;
    const activeModeValue = targetLed.activeMode;
    const modalActiveSolidEnabled = activeModeValue === "Solid";
    const previewPassiveColor = targetLed.passiveColor;
    const previewActiveColor = targetLed.activeColor;
    const selectorRowStyle = { display: "grid", gridTemplateColumns: "140px minmax(160px, 220px)", alignItems: "center", gap: "10px 12px", width: "100%" } as const;
    const pickerRowStyle = { display: "grid", gridTemplateColumns: "140px auto", alignItems: "center", gap: "10px 12px", width: "100%" } as const;
    const sliderRowStyle = { display: "grid", gridTemplateColumns: "140px 1fr 72px", alignItems: "center", gap: "10px 12px", width: "100%" } as const;

    return (
      <div id={`led-card-${target}`} className="led-grid" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div className="muted small" style={{ marginBottom: "8px" }}>
          Set the lighting modes and colors for this key.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontWeight: 600 }}>Lighting preview</div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <LightingPreview
              passiveMode={passiveMode}
              passiveColor={previewPassiveColor}
              activeMode={activeModeValue}
              activeColor={previewActiveColor}
              rainbowStepMs={targetLed.rainbowStepMs}
              breathingMinPercent={targetLed.breathingMinPercent}
              breathingStepMs={targetLed.breathingStepMs}
              ledIndex={target}
              size="md"
              interactive
              muted={false}
            />
            <div className="muted small" style={{ maxWidth: "340px" }}>
              Hold to see active lighting, release to return to passive. Does not show global brightness. Updates live when settings change.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div style={{ fontWeight: 600 }}>Passive lighting</div>
            <div className="muted small">Shows when the key is idle.</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
            <div style={selectorRowStyle}>
              <span className="muted small">Passive</span>
              <select
                value={passiveMode}
                onChange={(e) => setPassiveModeForLed(target, e.target.value as PassiveLedMode)}
              >
                <option value="Off">Off</option>
                <option value="Rainbow">Rainbow</option>
                <option value="Breathing">Breathing</option>
                <option value="Static">Static</option>
              </select>
            </div>
            {passiveMode === "Rainbow" && (
              <label className="muted small" style={sliderRowStyle}>
                <span>Rainbow step</span>
                <input
                  type="range"
                    min={5}
                    max={100}
                  step={1}
                  value={targetLed.rainbowStepMs}
                  onChange={(e) => setRainbowStepMs(target, Number(e.target.value))}
                />
                <span style={{ textAlign: "right" }}>{targetLed.rainbowStepMs} ms</span>
              </label>
            )}
            {passiveMode === "Breathing" && (
              <div style={{ display: "grid", gap: "8px", width: "100%" }}>
                <label className="muted small" style={pickerRowStyle}>
                  <span>Color</span>
                  <input
                    type="color"
                    value={colorToHex(targetLed.passiveColor)}
                    onChange={(e) => setPassiveColor(target, hexToColor(e.target.value))}
                  />
                </label>
                <label className="muted small" style={sliderRowStyle}>
                  <span>Min brightness</span>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    value={targetLed.breathingMinPercent}
                    onChange={(e) => setBreathingMinPercent(target, Number(e.target.value))}
                  />
                  <span style={{ textAlign: "right" }}>{targetLed.breathingMinPercent}%</span>
                </label>
                <label className="muted small" style={sliderRowStyle}>
                  <span>Breathing step</span>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={1}
                    value={targetLed.breathingStepMs}
                    onChange={(e) => setBreathingStepMs(target, Number(e.target.value))}
                  />
                  <span style={{ textAlign: "right" }}>{targetLed.breathingStepMs} ms</span>
                </label>
              </div>
            )}
            {passiveMode === "Static" && (
              <label className="muted small" style={pickerRowStyle}>
                <span>Color</span>
                <input
                  type="color"
                  value={colorToHex(targetLed.passiveColor)}
                  onChange={(e) => setPassiveColor(target, hexToColor(e.target.value))}
                />
              </label>
            )}
            <div className="muted small" style={{ width: "100%" }}>
              Lower step values run faster, higher step values slow the animations.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ fontWeight: 600 }}>Active lighting</div>
          <div className="muted small">Shows while the key is pressed.</div>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
          <span className="muted small" style={{ minWidth: "56px" }}>Active</span>
          <select
            value={targetLed.activeMode}
            onChange={(e) => setActiveMode(target, e.target.value as ActiveLedMode)}
          >
            <option value="Off">Off</option>
            <option value="Nothing">Nothing</option>
            <option value="Solid">Solid</option>
          </select>
          {modalActiveSolidEnabled && (
            <input
              type="color"
              value={colorToHex(targetLed.activeColor)}
              onChange={(e) => setActiveColor(target, hexToColor(e.target.value))}
            />
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => copyLedLighting(target, ledDisplayName(target))}>Copy</button>
            <button className="btn" disabled={!copiedLedLighting} onClick={() => pasteLedLighting(target, ledDisplayName(target))}>Paste</button>
              <button className="btn" onClick={() => applyLightingToAll(target, ledDisplayName(target))}>Apply to all</button>
          </div>
          <div style={{ minHeight: "18px", textAlign: "right" }}>
            <span className="muted small">{lightingStatus}</span>
          </div>
        </div>
      </div>
    );
  };
  const {
    ledConfig,
    setLedConfig,
    draftLedConfig,
    showGlobalLightingModal,
    showLightingModal,
    focusLedIndex,
    openGlobalLightingModal,
    closeGlobalLightingModal,
    saveGlobalLightingModal,
    openLightingModal,
    closeLightingModal,
    saveLightingModal,
    setPassiveColor,
    setPassiveModeForLed,
    setActiveMode,
    setActiveColor,
    setBrightnessPercent,
    setRainbowStepMs,
    setBreathingMinPercent,
    setBreathingStepMs,
    lightingStatus,
    copyLedLighting,
    pasteLedLighting,
    applyLightingToAll,
    copiedLedLighting,
  } = useLightingState();

  const showToast = useCallback((message: string, tone: Toast["tone"] = "info", durationMs = 3200) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ message, tone });
    toastTimerRef.current = window.setTimeout(() => setToast(null), durationMs);
  }, []);

  const ledCountFromLayout = useCallback((layout: DeviceLayoutDto | null): number => {
    if (!layout) return 0;
    let max = -1;
    layout.buttons.forEach((b) => {
      if (b.ledIndex > max) max = b.ledIndex;
    });
    return max + 1;
  }, []);

  const buildDefaultLedConfig = useCallback((layout: DeviceLayoutDto | null): LedConfigurationDto | null => {
    const count = ledCountFromLayout(layout);
    if (count <= 0) return null;
    const leds = Array.from({ length: count }, (_, idx): LedPerKeyDto => {
      const seq: LedColor[] = [
        { r: 255, g: 0, b: 0 },
        { r: 255, g: 255, b: 0 },
        { r: 0, g: 255, b: 0 },
      ];
      return {
        passiveMode: "Rainbow",
        passiveColor: seq[idx % seq.length],
        activeMode: "Solid",
        activeColor: { r: 255, g: 255, b: 255 },
        rainbowStepMs: DEFAULT_RAINBOW_STEP_MS,
        breathingMinPercent: DEFAULT_BREATHING_MIN_PERCENT,
        breathingStepMs: DEFAULT_BREATHING_STEP_MS,
      };
    });
    return {
      leds,
      brightnessPercent: 100,
    };
  }, [ledCountFromLayout]);

  const pickLedConfigForLayout = useCallback((layout: DeviceLayoutDto | null, config: LedConfigurationDto | null): LedConfigurationDto | null => {
    const count = ledCountFromLayout(layout);
    if (count <= 0) return null;
    if (config) return config;
    return buildDefaultLedConfig(layout);
  }, [buildDefaultLedConfig, ledCountFromLayout]);

  const assertLedConfigMatchesLayout = useCallback((layout: DeviceLayoutDto | null, config: LedConfigurationDto | null): LedConfigurationDto | null => {
    const count = ledCountFromLayout(layout);
    if (count <= 0) return null;
    if (!config) {
      throw new Error("Lighting configuration is required for this layout.");
    }
    if (config.leds.length !== count) {
      throw new Error(`Lighting configuration must have ${count} entries for this layout.`);
    }
    return config;
  }, [ledCountFromLayout]);

  const {
    rememberedBootloaderId,
    lastBootloaderIdRef,
    applyConnectedDevice,
    restoreSavedConfig,
  } = useConfigPersistence({
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
  });

  const {
    clientRef,
    webUsbAvailable,
    secure,
    isWindows,
    performConnect,
    handleDisconnect,
    startDemo,
  } = useBootloaderConnection({
    status,
    setStatus,
    applyConnectedDevice,
    restoreSavedConfig,
    connectedInfo,
    setConnectedInfo,
    demoMode,
    setDemoMode,
    onDisconnected: () => setProgress({ phase: "", current: 0, total: 0 }),
  });

  const {
    hexDragOver,
    fileInputRef,
    handleHexDragOver,
    handleHexDragLeave,
    handleHexDrop,
    handleHexClick,
    onHexFileChange,
    compileAndFlash,
  } = useFirmwareFlashing({
    clientRef,
    setStatus,
    setProgress,
    assertLedConfigMatchesLayout,
    selectedLayout,
    selectedProfile,
    currentBindings,
    ledConfig,
    disconnectClient: () => handleDisconnect(),
    debugFirmware,
    debugOptions,
  });

  const importTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const demoModalClosing = useModalClosing(showDemoModal, useCallback(() => setShowDemoModal(false), []));
  const globalLightingModalClosing = useModalClosing(showGlobalLightingModal, closeGlobalLightingModal);
  const lightingModalClosing = useModalClosing(showLightingModal, closeLightingModal);
  const { isClosing: demoModalClosingState, requestClose: requestDemoModalClose, handleAnimationEnd: handleDemoModalAnimationEnd } = demoModalClosing;
  const { isClosing: globalLightingClosing, requestClose: requestGlobalLightingClose, handleAnimationEnd: handleGlobalLightingAnimationEnd } = globalLightingModalClosing;
  const { isClosing: lightingClosing, requestClose: requestLightingClose, handleAnimationEnd: handleLightingAnimationEnd } = lightingModalClosing;

  const shouldShowConnectSpinner = status.state === "requesting" && !showConnectWizard;
  const connectSpinnerModal = useModalClosing(connectSpinnerOpen, useCallback(() => setConnectSpinnerOpen(false), []));
  const { isClosing: connectSpinnerClosing, requestClose: requestConnectSpinnerClose, handleAnimationEnd: handleConnectSpinnerAnimationEnd } = connectSpinnerModal;

  const updateWizardHidden = useCallback((hidden: boolean) => {
    setWizardHidden(hidden);
    saveConnectWizardHidden(hidden);
  }, []);

  const {
    showExportModal,
    setShowExportModal,
    showImportModal,
    setShowImportModal,
    exportText,
    exportCopyStatus,
    exportCopyFlash,
    importText,
    importError,
    setImportText,
    setImportError,
    openExportModal,
    handleExportCopy,
    openImportModal,
    applyImportedConfig,
  } = useConfigImportExport({
    currentBindings,
    selectedLayout,
    ledConfig,
    selectedProfileName: selectedProfile?.name ?? null,
    connectedInfo,
    rememberedBootloaderId,
    lastBootloaderIdRef,
    assertLedConfigMatchesLayout,
    setSelectedLayout,
    setCurrentBindings,
    setLedConfig,
    showToast,
    setStatus,
  });

  const exportModalClosing = useModalClosing(showExportModal, useCallback(() => setShowExportModal(false), [setShowExportModal]));
  const importModalClosing = useModalClosing(showImportModal, useCallback(() => {
    setShowImportModal(false);
    setImportError("");
  }, [setImportError, setShowImportModal]));
  const { isClosing: exportModalClosingState, requestClose: requestExportModalClose, handleAnimationEnd: handleExportModalAnimationEnd } = exportModalClosing;
  const { isClosing: importModalClosingState, requestClose: requestImportModalClose, handleAnimationEnd: handleImportModalAnimationEnd } = importModalClosing;

  const defaultDemoKey = "144-165-233-190"; // 6 Keys 1 Knob

  const demoOptions = useMemo(() => DEVICE_PROFILES
    .filter((profile) => !profile.hideFromDemo)
    .flatMap((profile) => profile.bootloaderIds.map((bootloaderKey) => ({
      key: bootloaderKey,
      name: profile.name,
      bootloaderId: bootloaderKey.split("-").map((n) => Number(n)).filter((n) => Number.isFinite(n)),
    }))), []);

  useEffect(() => () => {
    clientRef.current?.disconnect().catch(() => {});
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  useEffect(() => {
    if (!showImportModal) return;
    const el = importTextAreaRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [showImportModal]);

  useEffect(() => {
    if (!devMode && debugFirmware) {
      setDebugFirmware(false);
    }
  }, [devMode, debugFirmware]);

  useEffect(() => {
    if (!showDemoModal) return;
    const rememberedKey = (() => {
      const lastId = rememberedBootloaderId ?? lastBootloaderIdRef.current;
      const key = lastId ? lastId.join("-") : null;
      return key && demoOptions.some((opt) => opt.key === key) ? key : null;
    })();
    const preferredDefault = demoOptions.find((opt) => opt.key === defaultDemoKey)?.key ?? null;
    const fallback = preferredDefault ?? demoOptions[0]?.key ?? null;
    setSelectedDemoKey((prev) => {
      if (prev && demoOptions.some((opt) => opt.key === prev)) return prev;
      if (lastDemoKey && demoOptions.some((opt) => opt.key === lastDemoKey)) return lastDemoKey;
      if (rememberedKey) return rememberedKey;
      return fallback;
    });
  }, [showDemoModal, rememberedBootloaderId, demoOptions, lastDemoKey, defaultDemoKey]);

  const handleDemoToggle = useCallback(async () => {
    if (demoMode) {
      await handleDisconnect(true);
      return;
    }
    setShowDemoModal(true);
  }, [demoMode, handleDisconnect]);

  const openConnectWizard = useCallback(() => setShowConnectWizard(true), []);

  const handleConnectClick = useCallback(() => {
    if (wizardHidden) {
      void performConnect({ wizardHidden, onShowWizardPrompt: () => setShowWizardPrompt(true) });
      return;
    }
    openConnectWizard();
  }, [performConnect, wizardHidden, openConnectWizard]);

  const handleWizardConnect = useCallback(async () => {
    await performConnect({ origin: "wizard", wizardHidden, onShowWizardPrompt: () => setShowWizardPrompt(true) });
  }, [performConnect, wizardHidden]);

  const handleStartDemo = useCallback(async () => {
    await startDemo({
      selectedDemoKey,
      demoOptions,
      rememberDemoKey: (key) => { setLastDemoKey(key); saveLastDemoKey(key); },
      onBeforeStart: () => requestDemoModalClose(),
    });
  }, [demoOptions, requestDemoModalClose, selectedDemoKey, startDemo]);

  const unsupportedDevice = connectedInfo != null && selectedProfile == null;
  const userButtons = selectedLayout ? selectedLayout.buttons : [];
  const buttonCount = userButtons.length;
  const buttonBindings = new Map<number, HidBindingDto>();
  if (currentBindings) {
    currentBindings.buttons.forEach((entry) => buttonBindings.set(entry.id, entry.binding));
  }
  const encoderBindings = new Map<number, { clockwise: HidBindingDto; counterClockwise: HidBindingDto; press?: HidBindingDto }>();
  if (currentBindings) {
    currentBindings.encoders.forEach((entry) => encoderBindings.set(entry.id, entry));
  }

  const layoutLedCount = ledCountFromLayout(selectedLayout);

  const openEdit = (target: EditTarget) => {
    setEditorTarget(target);
    const binding = (() => {
      if (target.type === "button") return buttonBindings.get(target.buttonId) ?? null;
      const enc = encoderBindings.get(target.encoderId);
      if (!enc) return null;
      if (target.direction === "cw") return enc.clockwise;
      if (target.direction === "ccw") return enc.counterClockwise;
      return enc.press ?? null;
    })();
    setEditorBinding(binding);
  };

  const updateBootloaderOnBoot = (target: EditTarget, value: boolean) => {
    setSelectedLayout((prev) => {
      if (!prev) return prev;
      if (target.type === "button") {
        return {
          ...prev,
          buttons: prev.buttons.map((b) => (b.id === target.buttonId ? { ...b, bootloaderOnBoot: value } : b)),
        };
      }
      if (target.type === "encoder" && target.direction === "press") {
        return {
          ...prev,
          encoders: prev.encoders.map((e) => (e.id === target.encoderId && e.press
            ? { ...e, press: { ...e.press, bootloaderOnBoot: value } }
            : e)),
        };
      }
      return prev;
    });
  };

  const updateBootloaderChordMember = (target: EditTarget, value: boolean) => {
    setSelectedLayout((prev) => {
      if (!prev) return prev;
      if (target.type === "button") {
        return {
          ...prev,
          buttons: prev.buttons.map((b) => (b.id === target.buttonId ? { ...b, bootloaderChordMember: value } : b)),
        };
      }
      if (target.type === "encoder" && target.direction === "press") {
        return {
          ...prev,
          encoders: prev.encoders.map((e) => (e.id === target.encoderId && e.press
            ? { ...e, press: { ...e.press, bootloaderChordMember: value } }
            : e)),
        };
      }
      return prev;
    });
  };

  const colorToHex = (color: LedColor): string => {
    const toHex = (v: number) => v.toString(16).padStart(2, "0");
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  };

  const hexToColor = (hex: string): LedColor => {
    const cleaned = (hex || "").replace("#", "");
    if (cleaned.length !== 6) return { r: 255, g: 255, b: 255 };
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return { r: 255, g: 255, b: 255 };
    return { r, g, b };
  };

  const ledDisplayName = (idx: number): string => {
    const btn = userButtons.find((b) => b.ledIndex === idx);
    if (btn) return `Button ${btn.id + 1}`;
    return `Unmapped LED ${idx + 1}`;
  };
  const openLightingForLed = (idx: number) => {
    if (!ledConfig || idx < 0 || idx >= ledConfig.leds.length) return;
    openLightingModal(ledConfig, idx);
  };

  const openGlobalLighting = useCallback(() => {
    if (!ledConfig) {
      showToast("No lighting configuration available for this layout.", "warn", 3600);
      return;
    }
    openGlobalLightingModal();
  }, [ledConfig, openGlobalLightingModal, showToast]);

  useEffect(() => {
    if (!showLightingModal) return;
    if (focusLedIndex == null) return;
    const el = document.getElementById(`led-card-${focusLedIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [showLightingModal, focusLedIndex]);


  const handleEditorSave = (binding: HidBindingDto) => {
    if (!editorTarget || !currentBindings) return;
    if (editorTarget.type === "button") {
      const other = currentBindings.buttons.filter((b) => b.id !== editorTarget.buttonId);
      setCurrentBindings({
        ...currentBindings,
        buttons: [...other, { id: editorTarget.buttonId, binding }].sort((a, b) => a.id - b.id),
      });
      return;
    }

    const existing = currentBindings.encoders.find((e) => e.id === editorTarget.encoderId);
    const others = currentBindings.encoders.filter((e) => e.id !== editorTarget.encoderId);
    const updated = existing
      ? { ...existing }
      : { id: editorTarget.encoderId, clockwise: binding, counterClockwise: binding };

    if (editorTarget.direction === "cw") updated.clockwise = binding;
    if (editorTarget.direction === "ccw") updated.counterClockwise = binding;
    if (editorTarget.direction === "press") updated.press = binding;

    setCurrentBindings({ ...currentBindings, encoders: [...others, updated].sort((a, b) => a.id - b.id) });
  };

  const handleEditorClose = () => {
    setEditorTarget(null);
    setEditorBinding(null);
  };

  const resetToDefaults = () => {
    if (!selectedProfile) return;
    const nextBindings = selectedProfile.defaultBindings ?? null;
    const nextLayout = selectedProfile.layout ? cloneLayout(selectedProfile.layout) : null;
    const nextLedConfig = buildDefaultLedConfig(nextLayout);
    setCurrentBindings(nextBindings);
    setSelectedLayout(nextLayout);
    setLedConfig(nextLedConfig);
    if (connectedInfo) {
      saveStoredConfig(connectedInfo.id, { bindings: nextBindings, layout: nextLayout, ledConfig: nextLedConfig ?? null });
    }
    showToast("Reset to defaults", "success", 2600);
  };

  const baseRows = selectedLayout
    ? (selectedLayout.displayRows && selectedLayout.displayRows.length > 0
      ? [...selectedLayout.displayRows]
      : [buttonCount])
    : [];
  const { rows: layoutRows } = validateFixedRows(baseRows, buttonCount);

  const bootloaderOnBootCount = selectedLayout
    ? selectedLayout.buttons.filter((b) => b.bootloaderOnBoot).length
      + selectedLayout.encoders.filter((e) => e.press && e.press.bootloaderOnBoot).length
    : 0;
  const bootloaderChordCount = selectedLayout
    ? selectedLayout.buttons.filter((b) => b.bootloaderChordMember).length
      + selectedLayout.encoders.filter((e) => e.press && e.press.bootloaderChordMember).length
    : 0;
  const warnNoBootEntry = Boolean(selectedLayout && bootloaderOnBootCount === 0 && bootloaderChordCount === 0);
  const warnSingleChord = Boolean(selectedLayout && bootloaderChordCount === 1);

  const statusBanner: { tone: "info" | "success" | "warn" | "error"; title: string; body?: ReactNode; showSpinner?: boolean } | null = (() => {
    switch (status.state) {
      case "requesting":
        return { tone: "info" as const, title: "Requesting device…", body: "Select a device from the browser popup" };
      case "connectedKnown":
        return { tone: "success" as const, title: `Connected: ${status.detail ?? "Device detected"}`, body: "Ready to compile and flash" };
      case "connectedUnknown":
        return { tone: "warn" as const, title: "Device not recognized", body: "Use debug firmware or pick a supported layout  " };
      case "compiling":
        return { tone: "info" as const, title: "Compiling firmware…", body: status.detail ? `Building ${status.detail}` : undefined, showSpinner: true };
      case "unsupported":
        return { tone: "warn" as const, title: "Unknown device", body: status.detail };
      case "flashing":
        return { tone: "info" as const, title: "Flashing firmware…", body: "Keep the device connected until it finishes" };
      case "flashDone":
        return { tone: "success" as const, title: "Flash finished", body: "Reconnect the device before flashing again" };
      case "compileError":
        return {
          tone: "error" as const,
          title: "Compile failed",
          body: status.detail ? <pre className="code-block status-code-block">{status.detail}</pre> : undefined,
        };
      case "flashError":
        return { tone: "error" as const, title: "Flash failed", body: status.detail };
      case "fileApiMissing":
        return { tone: "error" as const, title: "File upload not supported in this browser." };
      case "needConnect":
        return { tone: "warn" as const, title: "Connect bootloader first", body: "Click Connect and approve the prompt." };
      case "deviceLost":
        return { tone: "warn" as const, title: "Device disconnected", body: status.detail ?? "Reconnect to continue." };
      case "error":
        return { tone: "error" as const, title: "Error", body: status.detail };
      default:
          return null;
    }
  })();

  const statusProgress = progress.total > 0 ? progress : null;

  useEffect(() => {
    if ((status.state === "connectedKnown" || status.state === "connectedUnknown") && !wizardHidden) {
      updateWizardHidden(true);
    }
  }, [status.state, wizardHidden, updateWizardHidden]);

  useEffect(() => {
    if (shouldShowConnectSpinner) {
      setConnectSpinnerOpen(true);
      return;
    }
    if (connectSpinnerOpen) {
      requestConnectSpinnerClose();
    }
  }, [connectSpinnerOpen, requestConnectSpinnerClose, shouldShowConnectSpinner]);

  return (
    <div className="app-shell">
      {toast && (
        <div className="toast-container" role="status" aria-live="polite">
          <div className={`toast toast-${toast.tone}`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
      <div className="container">
        <header>
          <h1 className="title">Keypad Flasher</h1>
          <p className="muted">Flash supported CH55X-based keypads directly from your browser using WebUSB.</p>
          <p className="muted small">
            <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher" target="_blank" rel="noreferrer">GitHub</a>
            <span aria-hidden="true"> | </span>
            <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher#usage" target="_blank" rel="noreferrer">Docs</a>
          </p>
        </header>

        <div className="actions">
          <button onClick={handleConnectClick} className="btn">Connect</button>
          {!demoMode && (
            <button
              onClick={handleDemoToggle}
              className="btn btn-demo"
              disabled={Boolean(connectedInfo)}
              title="Start demo mode to explore the UI without connecting a real device."
            >
              Start Demo
            </button>
          )}
          {connectedInfo && (
            <button onClick={() => void handleDisconnect(true)} className="btn">Disconnect</button>
          )}
          {devMode && (
            <>
              <button
                className={`btn${hexDragOver ? " btn-drop" : ""}`}
                disabled={!clientRef.current}
                onClick={handleHexClick}
                onDragOver={handleHexDragOver}
                onDragEnter={handleHexDragOver}
                onDragLeave={handleHexDragLeave}
                onDrop={handleHexDrop}
              >
                Upload .hex
              </button>
              <input ref={fileInputRef} type="file" accept=".hex,.ihx,.ihex,.txt" className="hidden" onChange={onHexFileChange} />
            </>
          )}
          <button onClick={compileAndFlash} className="btn btn-primary" disabled={!clientRef.current || (!selectedLayout && !debugFirmware)}>
            Compile & Flash
          </button>
        </div>

        {devMode && (
          <div className="panel" style={{ marginBottom: "10px" }}>
            <div className="panel-header">
              <div className="panel-title">Development tools</div>
              <label className="checkbox">
                <input type="checkbox" checked={debugFirmware} onChange={(event) => setDebugFirmware(event.target.checked)} />
                Debug firmware (USB CDC)
              </label>
            </div>
            <p className="muted small">
              Use debug firmware to expose a USB CDC serial console for troubleshooting layouts. See the <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher#adding-support-for-new-keypads" target="_blank" rel="noreferrer">adding support guide</a> for wiring notes, LED direction tips, and how to contribute new keypad profiles.
            </p>
            {debugFirmware && (
              <div className="card subtle" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <div className="card-title" style={{ marginBottom: 0 }}>Debug firmware options</div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button className="btn" onClick={() => setDebugOptions(classicDebugOptions)}>Raw (no filtering/pull-ups)</button>
                    <button className="btn" onClick={() => setDebugOptions(defaultDebugOptions)}>Reset defaults</button>
                  </div>
                </div>
                <div className="muted small">
                  Tweak how the debug logger handles floating pins and noisy edges.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                  <label className="checkbox" title="Majority-vote a few quick samples before logging a change to filter out glitches.">
                    <input
                      type="checkbox"
                      checked={debugOptions.enableNoiseFilter}
                      onChange={(e) => setDebugOptions((prev) => ({ ...prev, enableNoiseFilter: e.target.checked }))}
                    />
                    Enable noise filter
                  </label>
                  <label className="checkbox" title="Use INPUT_PULLUP on unassigned pins to bias floating lines high.">
                    <input
                      type="checkbox"
                      checked={debugOptions.enablePullups}
                      onChange={(e) => setDebugOptions((prev) => ({ ...prev, enablePullups: e.target.checked }))}
                    />
                    Pull-ups on unassigned pins
                  </label>
                  <label className="inline-input">
                    <span className="input-label" title="How many quick samples to take when a pin flips before logging it.">Confirm samples</span>
                    <input
                      id="debug-confirm-samples"
                      className="text-input"
                      type="number"
                      min={1}
                      max={255}
                      value={debugOptions.confirmSamples}
                      onChange={(e) => setDebugOptions((prev) => ({ ...prev, confirmSamples: Number(e.target.value) || 1 }))}
                    />
                  </label>
                  <label className="inline-input">
                    <span className="input-label" title="Delay in milliseconds between confirmation samples when the filter is on.">Confirm delay (ms)</span>
                    <input
                      id="debug-confirm-delay"
                      className="text-input"
                      type="number"
                      min={0}
                      max={255}
                      value={debugOptions.confirmDelayMs}
                      onChange={(e) => setDebugOptions((prev) => ({ ...prev, confirmDelayMs: Math.max(0, Number(e.target.value) || 0) }))}
                    />
                  </label>
                </div>
              </div>
            )}
            <div className="card subtle" style={{ marginTop: "12px" }}>
              <div className="card-title">Connected device</div>
              <div>Bootloader: {connectedInfo ? connectedInfo.version : "n/a"}</div>
              <div>Bootloader ID: {connectedInfo ? connectedInfo.id.join(", ") : "n/a"}</div>
              <div>Device ID: {connectedInfo ? connectedInfo.deviceIdHex : "n/a"}</div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {connectedInfo ? (
            <div className="detected-card">
              <div className="detected-header">
                <span className="pill">Detected device</span>
                {demoMode && <span className="pill pill-demo">Demo</span>}
                {!selectedProfile && <span className="pill pill-warn">Unknown</span>}
              </div>
              <div className="detected-name">{selectedProfile?.name ?? "Unknown device"}</div>
              {!selectedProfile && (
                <div className="detected-help">
                  Not recognized. Use debug firmware or view supported layouts.
                </div>
              )}
            </div>
          ) : (
            <div className="muted small">Not connected</div>
          )}

          {statusBanner && (
            <StatusBanner
              tone={statusBanner.tone}
              title={statusBanner.title}
              body={statusBanner.body}
              showSpinner={statusBanner.showSpinner}
              progress={statusProgress}
            />
          )}
        </div>

        {/* Lighting controls moved into modal; open from Layout card. */}

        {selectedLayout && (
          <>
            {!layoutLedCount && (
              <div className="status-banner status-warn" style={{ marginTop: "10px" }}>
                <div className="status-title">No LEDs on this device</div>
                <div className="status-body">This device has no LEDs available, so lighting controls are unavailable.</div>
              </div>
            )}
            {layoutLedCount > 0 && !ledConfig && (
              <div className="status-banner status-warn" style={{ marginTop: "10px" }}>
                <div className="status-title">Lighting config unavailable</div>
                <div className="status-body">This device did not provide lighting configuration data.</div>
              </div>
            )}
          </>
        )}

        {selectedLayout && (
          <LayoutPreview
            layout={selectedLayout}
            layoutRows={layoutRows}
            buttonBindings={buttonBindings}
            encoderBindings={encoderBindings}
            ledConfig={ledConfig}
            warnNoBootEntry={warnNoBootEntry}
            warnSingleChord={warnSingleChord}
            onEdit={openEdit}
            onOpenLightingForLed={openLightingForLed}
            onOpenLightingSettings={openGlobalLighting}
            lightingDisabled={!ledConfig || layoutLedCount === 0}
            onToggleBootloaderOnBoot={updateBootloaderOnBoot}
            onToggleBootloaderChord={updateBootloaderChordMember}
            onExportConfig={openExportModal}
            onImportConfig={openImportModal}
            onResetDefaults={selectedProfile?.defaultBindings ? resetToDefaults : undefined}
            canReset={Boolean(selectedProfile?.defaultBindings)}
          />
        )}

        {editorTarget && (
          <StepEditor
            target={editorTarget}
            binding={editorBinding}
            stepClipboard={stepClipboard}
            onSave={handleEditorSave}
            onClose={handleEditorClose}
            onUpdateStepClipboard={setStepClipboard}
            onError={(detail) => setStatus({ state: "error", detail })}
          />
        )}

        <ConnectWizardPrompt
          isOpen={showWizardPrompt}
          onCancel={() => setShowWizardPrompt(false)}
          onConfirm={() => { updateWizardHidden(false); openConnectWizard(); }}
        />

        <ConnectWizard
          isOpen={showConnectWizard}
          status={status}
          isWindows={isWindows}
          onClose={() => setShowConnectWizard(false)}
          onRequestConnect={handleWizardConnect}
        />

        {(connectSpinnerOpen || connectSpinnerClosing) && (
          <ConnectSpinner
            closing={connectSpinnerClosing}
            onAnimationEnd={handleConnectSpinnerAnimationEnd}
          />
        )}

        {showDemoModal && (
          <div
            className={`modal-backdrop${demoModalClosingState ? " closing" : ""}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (modalPointerDownRef.current) { modalPointerDownRef.current = false; return; }
              if (e.target === e.currentTarget) requestDemoModalClose();
            }}
            onAnimationEnd={(e) => handleDemoModalAnimationEnd(e.animationName)}
          >
            <div
              className={`modal config-modal demo-modal${demoModalClosingState ? " closing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={() => { modalPointerDownRef.current = true; }}
              onMouseUp={() => { modalPointerDownRef.current = false; }}
              onAnimationEnd={(e) => handleDemoModalAnimationEnd(e.animationName)}
            >
              <div className="modal-header">
                <div className="modal-title">Choose a demo device</div>
              </div>
              <div className="modal-body">
                <p className="muted small">Pick a supported device profile to explore the UI without connecting hardware.</p>
                {demoOptions.length === 0 ? (
                  <div className="muted small">No demo devices available.</div>
                ) : (
                  <div className="space-y-2">
                    {demoOptions.map((opt) => (
                      <label key={opt.key} className={`demo-option${selectedDemoKey === opt.key ? " demo-option-selected" : ""}`}>
                        <input
                          type="radio"
                          name="demo-device"
                          value={opt.key}
                          checked={selectedDemoKey === opt.key}
                          onChange={() => setSelectedDemoKey(opt.key)}
                        />
                        <div className="demo-option-body">
                          <div className="demo-option-name">{opt.name}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button className="btn" onClick={requestDemoModalClose}>Cancel</button>
                <button className="btn btn-primary" onClick={handleStartDemo} disabled={!selectedDemoKey || demoOptions.length === 0}>Start demo</button>
              </div>
            </div>
          </div>
        )}

        {showGlobalLightingModal && (
          <div
            className={`modal-backdrop${globalLightingClosing ? " closing" : ""}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (modalPointerDownRef.current) { modalPointerDownRef.current = false; return; }
              if (e.target === e.currentTarget) requestGlobalLightingClose();
            }}
            onAnimationEnd={(e) => handleGlobalLightingAnimationEnd(e.animationName)}
          >
            <div
              className={`modal lighting-modal${globalLightingClosing ? " closing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={() => { modalPointerDownRef.current = true; }}
              onMouseUp={() => { modalPointerDownRef.current = false; }}
              onAnimationEnd={(e) => handleGlobalLightingAnimationEnd(e.animationName)}
            >
              <div className="modal-header">
                <div className="modal-title">Global lighting</div>
              </div>
              <div className="modal-body">
                {draftLedConfig ? (
                  <div className="space-y-2">
                    <div className="muted small">These settings apply to every button LED on the device.</div>
                    <label className="muted small" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                      <span>Global brightness</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={draftLedConfig.brightnessPercent}
                        onChange={(e) => setBrightnessPercent(Number(e.target.value))}
                      />
                      <span style={{ minWidth: "36px", textAlign: "right" }}>{draftLedConfig.brightnessPercent}%</span>
                    </label>
                    <div className="muted small">Brightness scales both passive and active effects together.</div>
                  </div>
                ) : (
                  <div className="muted small">No lighting configuration available.</div>
                )}
              </div>
              <div className="modal-actions">
                <button className="btn" onClick={requestGlobalLightingClose}>Cancel</button>
                <button className="btn btn-primary" onClick={saveGlobalLightingModal} disabled={!draftLedConfig}>Save</button>
              </div>
            </div>
          </div>
        )}

        {showLightingModal && selectedLayout && (
          <div
            className={`modal-backdrop${lightingClosing ? " closing" : ""}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (modalPointerDownRef.current) { modalPointerDownRef.current = false; return; }
              if (e.target === e.currentTarget) requestLightingClose();
            }}
            onAnimationEnd={(e) => handleLightingAnimationEnd(e.animationName)}
          >
            <div
              className={`modal lighting-modal${lightingClosing ? " closing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={() => { modalPointerDownRef.current = true; }}
              onMouseUp={() => { modalPointerDownRef.current = false; }}
              onAnimationEnd={(e) => handleLightingAnimationEnd(e.animationName)}
            >
              <div className="modal-header">
                {(() => {
                  const target = focusLedIndex != null ? focusLedIndex : 0;
                  const maxIdx = draftLedConfig?.leds.length ?? 0;
                  const clamped = maxIdx > 0 ? Math.min(Math.max(target, 0), maxIdx - 1) : 0;
                  const title = maxIdx > 0 ? `Edit ${ledDisplayName(clamped)} Lighting` : "Lighting";
                  return <div className="modal-title">{title}</div>;
                })()}
              </div>
              <div className="modal-body">
                {renderLightingBody()}
              </div>
              <div className="modal-actions">
                <button className="btn" onClick={requestLightingClose}>Cancel</button>
                <button className="btn btn-primary" onClick={saveLightingModal} disabled={!draftLedConfig}>Save</button>
              </div>
            </div>
          </div>
        )}

        {showExportModal && (
          <div
            className={`modal-backdrop${exportModalClosingState ? " closing" : ""}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (modalPointerDownRef.current) { modalPointerDownRef.current = false; return; }
              if (e.target === e.currentTarget) requestExportModalClose();
            }}
            onAnimationEnd={(e) => handleExportModalAnimationEnd(e.animationName)}
          >
            <div
              className={`modal config-modal${exportModalClosingState ? " closing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={() => { modalPointerDownRef.current = true; }}
              onMouseUp={() => { modalPointerDownRef.current = false; }}
              onAnimationEnd={(e) => handleExportModalAnimationEnd(e.animationName)}
            >
              <div className="modal-header">
                <div className="modal-title">Export configuration</div>
              </div>
              <div className="modal-body">
                <p className="muted small">Click the block to copy. This includes layout, bindings, and lighting.</p>
                <pre
                  className={`code-block clickable${exportCopyFlash ? " code-block-flash" : ""}`}
                  onClick={handleExportCopy}
                  title="Click to copy"
                  aria-label="Exported configuration JSON"
                >{exportText}</pre>
                <div className="muted small" style={{ minHeight: "18px" }}>{exportCopyStatus}</div>
              </div>
              <div className="modal-actions">
                <button className="btn" onClick={requestExportModalClose}>Close</button>
              </div>
            </div>
          </div>
        )}

        {showImportModal && (
          <div
            className={`modal-backdrop${importModalClosingState ? " closing" : ""}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (modalPointerDownRef.current) { modalPointerDownRef.current = false; return; }
              if (e.target === e.currentTarget) requestImportModalClose();
            }}
            onAnimationEnd={(e) => handleImportModalAnimationEnd(e.animationName)}
          >
            <div
              className={`modal config-modal${importModalClosingState ? " closing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={() => { modalPointerDownRef.current = true; }}
              onMouseUp={() => { modalPointerDownRef.current = false; }}
              onAnimationEnd={(e) => handleImportModalAnimationEnd(e.animationName)}
            >
              <div className="modal-header">
                <div className="modal-title">Import configuration</div>
              </div>
              <div className="modal-body">
                <p className="muted small">Paste an exported configuration below. It will replace the current layout, bindings, and lighting.</p>
                <textarea
                  className="code-block text-area"
                  style={{ width: "100%", minHeight: "220px" }}
                  ref={importTextAreaRef}
                  value={importText}
                  onChange={(e) => { setImportText(e.target.value); setImportError(""); }}
                  placeholder="Paste configuration JSON here"
                />
                {importError && <div className="status-banner status-error" style={{ marginTop: "8px" }}><div className="status-title">Import error</div><div className="status-body">{importError}</div></div>}
              </div>
              <div className="modal-actions">
                <button className="btn" onClick={requestImportModalClose}>Cancel</button>
                <button className="btn btn-primary" onClick={() => applyImportedConfig(importText)}>Import</button>
              </div>
            </div>
          </div>
        )}

        {!webUsbAvailable && (
          <div className="panel warn">Your browser does not support WebUSB. Try Chromium-based browsers over HTTPS.</div>
        )}
        {webUsbAvailable && !secure && (
          <div className="panel warn">This page is not a secure context. WebUSB usually requires HTTPS.</div>
        )}
        {unsupportedDevice && (
          <div className="panel warn">
            <div>Connected device is not recognized as a supported layout.</div>
            <div>You can still flash debug firmware, or see supported devices.</div>
            <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher#supported-devices" target="_blank" rel="noreferrer">View supported devices</a>
          </div>
        )}
      </div>
      <div className="dev-toggle">
        <label className="dev-toggle-label">
          <input type="checkbox" checked={devMode} onChange={(event) => setDevMode(event.target.checked)} />
          Development mode
        </label>
      </div>
    </div>
  );
}
