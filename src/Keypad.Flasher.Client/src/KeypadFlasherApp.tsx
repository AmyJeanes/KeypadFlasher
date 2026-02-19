/// <reference types="w3c-web-usb" />
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import {
  CH55xBootloader,
  FakeBootloader,
  normalizeUsbErrorMessage,
  parseIntelHexBrowser,
  type BootloaderClient,
  type ConnectedInfo,
  type Progress,
} from "./lib/ch55x-bootloader";
import {
  findProfileForBootloaderId,
  DEVICE_PROFILES,
  type BindingProfileDto,
  type DeviceLayoutDto,
  type HidBindingDto,
  type HidStepDto,
  type KnownDeviceProfile,
} from "./lib/keypad-configs";
import { normalizeIncomingStep } from "./lib/binding-utils";
import { cloneLayout, loadConnectWizardHidden, loadLastBootloaderId, loadLastDemoKey, loadStoredConfig, saveConnectWizardHidden, saveLastBootloaderId, saveLastDemoKey, saveStoredConfig } from "./lib/layout-storage";
import { LayoutPreview } from "./components/LayoutPreview";
import { LightingPreview } from "./components/LightingPreview";
import { ConnectSpinner } from "./components/ConnectSpinner";
import { StatusBanner } from "./components/StatusBanner";
import { StepEditor } from "./components/StepEditor";
import type { EditTarget, LedConfigurationDto, LedColor, PassiveLedMode, ActiveLedMode } from "./types";
import "./styles/base.css";

type FirmwareRequestBody = {
  layout: DeviceLayoutDto | null;
  bindingProfile: BindingProfileDto | null;
  debug: boolean;
  ledConfig: LedConfigurationDto | null;
  debugOptions: DebugOptionsDto | null;
};

type DebugOptionsDto = {
  enableNoiseFilter: boolean;
  enablePullups: boolean;
  confirmSamples: number;
  confirmDelayMs: number;
};

type StatusState =
  | "idle"
  | "requesting"
  | "connectedKnown"
  | "connectedUnknown"
  | "compiling"
  | "unsupported"
  | "flashing"
  | "flashDone"
  | "compileError"
  | "flashError"
  | "fileApiMissing"
  | "needConnect"
  | "deviceLost"
  | "error";

type Status = { state: StatusState; detail?: string };

type Toast = { message: string; tone: "info" | "success" | "warn" | "error" };

type BootloaderConfig = {
  buttons: { id: number; bootloaderOnBoot: boolean; bootloaderChordMember: boolean }[];
  encoders: { id: number; press?: { bootloaderOnBoot: boolean; bootloaderChordMember: boolean } }[];
};

type ConnectWizardStep = { id: "keypad" | "windows-driver" | "bootloader" | "connect"; title: string };

type ModalClosing = {
  isClosing: boolean;
  requestClose: () => void;
  handleAnimationEnd: (animationName: string) => void;
};

function useModalClosing(isOpen: boolean, onClosed: () => void): ModalClosing {
  const [isClosing, setIsClosing] = useState(false);
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    pendingRef.current.clear();
    setIsClosing(false);
  }, [isOpen]);

  const requestClose = useCallback(() => {
    if (!isOpen || isClosing) return;
    pendingRef.current = new Set(["modal-pop-out", "backdrop-fade-out"]);
    setIsClosing(true);
  }, [isClosing, isOpen]);

  const handleAnimationEnd = useCallback((animationName: string) => {
    if (!isClosing) return;
    if (!pendingRef.current.has(animationName)) return;
    pendingRef.current.delete(animationName);
    if (pendingRef.current.size === 0) {
      pendingRef.current.clear();
      setIsClosing(false);
      onClosed();
    }
  }, [isClosing, onClosed]);

  return { isClosing, requestClose, handleAnimationEnd };
}

function validateFixedRows(rows: number[], buttonCount: number): { rows: number[]; error: string | null } {
  const total = rows.reduce((sum, n) => sum + n, 0);
  if (total === buttonCount) return { rows, error: null };
  const fallback = buttonCount > 0 ? [buttonCount] : [];
  return {
    rows: fallback,
    error: `Layout rows total ${total}, expected ${buttonCount}. Falling back to single-row preview.`,
  };
}

const sameBootloaderId = (a: number[] | null, b: number[] | null): boolean => {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, idx) => v === b[idx]);
};

const isSequenceBinding = (value: unknown): value is HidBindingDto => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HidBindingDto>;
  return candidate.type === "Sequence" && Array.isArray(candidate.steps);
};

const toSequenceBinding = (value: unknown, label: string): HidBindingDto => {
  if (!isSequenceBinding(value)) throw new Error(`${label} binding invalid.`);
  return { type: "Sequence", steps: value.steps.map((step) => normalizeIncomingStep(step)) };
};

const requireNumber = (value: unknown, label: string): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error(`${label} must be a number.`);
};

const requireBoolean = (value: unknown, label: string): boolean => {
  if (typeof value === "boolean") return value;
  throw new Error(`${label} must be a boolean.`);
};

const validateBootloaderConfigCandidate = (raw: unknown): BootloaderConfig => {
  if (!raw || typeof raw !== "object") throw new Error("Bootloader config must be an object.");
  const candidate = raw as { buttons?: unknown; encoders?: unknown };
  if (!Array.isArray(candidate.buttons)) throw new Error("Bootloader config missing buttons array.");
  if (!Array.isArray(candidate.encoders)) throw new Error("Bootloader config missing encoders array.");
  const buttons = candidate.buttons.map((b) => {
    if (!b || typeof b !== "object") throw new Error("Bootloader button invalid.");
    const { id, bootloaderOnBoot, bootloaderChordMember } = b as { id?: unknown; bootloaderOnBoot?: unknown; bootloaderChordMember?: unknown };
    return {
      id: requireNumber(id, "Bootloader button id"),
      bootloaderOnBoot: requireBoolean(bootloaderOnBoot, "Bootloader button bootloaderOnBoot"),
      bootloaderChordMember: requireBoolean(bootloaderChordMember, "Bootloader button bootloaderChordMember"),
    };
  });
  const encoders = candidate.encoders.map((e) => {
    if (!e || typeof e !== "object") throw new Error("Bootloader encoder invalid.");
    const { id, press } = e as { id?: unknown; press?: unknown };
    const validatedPress = press != null
      ? {
          bootloaderOnBoot: requireBoolean((press as { bootloaderOnBoot?: unknown }).bootloaderOnBoot, "Bootloader encoder press bootloaderOnBoot"),
          bootloaderChordMember: requireBoolean((press as { bootloaderChordMember?: unknown }).bootloaderChordMember, "Bootloader encoder press bootloaderChordMember"),
        }
      : undefined;
    return { id: requireNumber(id, "Bootloader encoder id"), press: validatedPress };
  });
  return { buttons, encoders };
};

const validateBindingProfileCandidate = (raw: unknown): BindingProfileDto => {
  if (!raw || typeof raw !== "object") throw new Error("Bindings must be an object.");
  const candidate = raw as { buttons?: unknown; encoders?: unknown };
  if (!Array.isArray(candidate.buttons)) throw new Error("Bindings must include buttons array.");
  if (!Array.isArray(candidate.encoders)) throw new Error("Bindings must include encoders array.");
  const btns = candidate.buttons;
  const encs = candidate.encoders;
  const buttons = btns.map((b): BindingProfileDto["buttons"][number] => {
    if (!b || typeof b !== "object") throw new Error("Button binding invalid.");
    const { id, binding } = b as { id?: unknown; binding?: unknown };
    if (typeof id !== "number" || !Number.isFinite(id)) throw new Error("Button binding id missing.");
    const normalizedBinding = toSequenceBinding(binding, "Button");
    return { id, binding: normalizedBinding };
  });
  const encoders = encs.map((e): BindingProfileDto["encoders"][number] => {
    if (!e || typeof e !== "object") throw new Error("Encoder binding invalid.");
    const { id, clockwise, counterClockwise, press } = e as { id?: unknown; clockwise?: unknown; counterClockwise?: unknown; press?: unknown };
    if (typeof id !== "number" || !Number.isFinite(id)) throw new Error("Encoder binding id missing.");
    const base: { id: number; clockwise: HidBindingDto; counterClockwise: HidBindingDto; press?: HidBindingDto } = {
      id,
      clockwise: toSequenceBinding(clockwise, "Encoder clockwise"),
      counterClockwise: toSequenceBinding(counterClockwise, "Encoder counter-clockwise"),
    };
    if (press != null) {
      base.press = toSequenceBinding(press, "Encoder press");
    }
    return base;
  });
  return { buttons, encoders };
};

const validateLedConfigCandidate = (raw: unknown): LedConfigurationDto => {
  if (!raw || typeof raw !== "object") throw new Error("LED config must be an object.");
  const rawConfig = raw as {
    passiveModes?: unknown;
    passiveColors?: unknown;
    activeModes?: unknown;
    activeColors?: unknown;
    brightnessPercent?: unknown;
    rainbowStepMs?: unknown;
    breathingMinPercent?: unknown;
    breathingStepMs?: unknown;
  };
  if (!Array.isArray(rawConfig.passiveModes)) throw new Error("LED config missing passiveModes array.");
  if (!Array.isArray(rawConfig.passiveColors)) throw new Error("LED config missing passiveColors array.");
  if (!Array.isArray(rawConfig.activeModes)) throw new Error("LED config missing activeModes array.");
  if (!Array.isArray(rawConfig.activeColors)) throw new Error("LED config missing activeColors array.");

  const normColor = (color: unknown): LedColor => {
    if (!color || typeof color !== "object") throw new Error("LED color must be an object.");
    const candidateColor = color as { r?: unknown; g?: unknown; b?: unknown };
    return {
      r: requireNumber(candidateColor.r, "LED color r"),
      g: requireNumber(candidateColor.g, "LED color g"),
      b: requireNumber(candidateColor.b, "LED color b"),
    };
  };

  const normalizePassiveMode = (mode: unknown): PassiveLedMode => {
    if (mode === "Off" || mode === "Rainbow" || mode === "Static" || mode === "Breathing") return mode;
    throw new Error("LED passive mode invalid.");
  };
  const normalizeActiveMode = (mode: unknown): ActiveLedMode => {
    if (mode === "Off" || mode === "Solid" || mode === "Nothing") return mode;
    throw new Error("LED active mode invalid.");
  };

  return {
    passiveModes: rawConfig.passiveModes.map((m) => normalizePassiveMode(m)),
    passiveColors: rawConfig.passiveColors.map((c) => normColor(c)),
    activeModes: rawConfig.activeModes.map((m) => normalizeActiveMode(m)),
    activeColors: rawConfig.activeColors.map((c) => normColor(c)),
    brightnessPercent: requireNumber(rawConfig.brightnessPercent, "LED brightnessPercent"),
    rainbowStepMs: requireNumber(rawConfig.rainbowStepMs, "LED rainbowStepMs"),
    breathingMinPercent: requireNumber(rawConfig.breathingMinPercent, "LED breathingMinPercent"),
    breathingStepMs: requireNumber(rawConfig.breathingStepMs, "LED breathingStepMs"),
  };
};

const bootloaderConfigFromLayout = (layout: DeviceLayoutDto): BootloaderConfig => ({
  buttons: layout.buttons.map((b) => ({ id: b.id, bootloaderOnBoot: b.bootloaderOnBoot, bootloaderChordMember: b.bootloaderChordMember })),
  encoders: layout.encoders.map((e) => ({ id: e.id, press: e.press ? { bootloaderOnBoot: e.press.bootloaderOnBoot, bootloaderChordMember: e.press.bootloaderChordMember } : undefined })),
});

const applyBootloaderConfigToLayout = (layout: DeviceLayoutDto, config: BootloaderConfig): DeviceLayoutDto => {
  const buttonMap = new Map(config.buttons.map((b) => [b.id, b] as const));
  const encoderMap = new Map(config.encoders.map((e) => [e.id, e] as const));
  return {
    ...layout,
    buttons: layout.buttons.map((b) => {
      const cfg = buttonMap.get(b.id);
      return cfg ? { ...b, bootloaderOnBoot: cfg.bootloaderOnBoot, bootloaderChordMember: cfg.bootloaderChordMember } : b;
    }),
    encoders: layout.encoders.map((e) => {
      const cfg = encoderMap.get(e.id);
      if (!cfg || !e.press) return e;
      if (!cfg.press) return { ...e, press: { ...e.press, bootloaderOnBoot: false, bootloaderChordMember: false } };
      return { ...e, press: { ...e.press, bootloaderOnBoot: cfg.press.bootloaderOnBoot, bootloaderChordMember: cfg.press.bootloaderChordMember } };
    }),
  };
};

export default function KeypadFlasherApp() {
  const [status, setStatus] = useState<Status>({ state: "idle" });
    const [connectedInfo, setConnectedInfo] = useState<ConnectedInfo | null>(null);
    const [progress, setProgress] = useState<Progress>({ phase: "", current: 0, total: 0 });
  const renderLightingBody = () => {
    if (layoutLedCount === 0 || !draftLedConfig)
    {
      return <div className="muted small">This layout has no LEDs mapped.</div>;
    }

    const target = focusLedIndex != null ? focusLedIndex : 0;
    const activeConfig = draftLedConfig;
    const modalLedCount = activeConfig?.passiveColors.length ?? 0;
    const passiveModeCount = activeConfig?.passiveModes.length ?? 0;
    if (target < 0 || target >= modalLedCount || target >= passiveModeCount)
    {
      return <div className="muted small">LED out of range.</div>;
    }

    const passiveMode = activeConfig.passiveModes[target];
    const activeModeValue = activeConfig.activeModes[target];
    const modalActiveSolidEnabled = activeModeValue === "Solid";
    const previewPassiveColor = activeConfig.passiveColors[target];
    const previewActiveColor = activeConfig.activeColors[target];
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
              rainbowStepMs={draftLedConfig.rainbowStepMs}
              breathingMinPercent={draftLedConfig.breathingMinPercent}
              breathingStepMs={draftLedConfig.breathingStepMs}
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
                  value={draftLedConfig.rainbowStepMs}
                  onChange={(e) => setRainbowStepMs(Number(e.target.value))}
                />
                <span style={{ textAlign: "right" }}>{draftLedConfig.rainbowStepMs} ms</span>
              </label>
            )}
            {passiveMode === "Breathing" && (
              <div style={{ display: "grid", gap: "8px", width: "100%" }}>
                <label className="muted small" style={pickerRowStyle}>
                  <span>Color</span>
                  <input
                    type="color"
                    value={colorToHex(activeConfig.passiveColors[target])}
                    onChange={(e) => setPassiveColor(target, hexToColor(e.target.value))}
                  />
                </label>
                <label className="muted small" style={sliderRowStyle}>
                  <span>Min brightness</span>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    value={draftLedConfig.breathingMinPercent}
                    onChange={(e) => setBreathingMinPercent(Number(e.target.value))}
                  />
                  <span style={{ textAlign: "right" }}>{draftLedConfig.breathingMinPercent}%</span>
                </label>
                <label className="muted small" style={sliderRowStyle}>
                  <span>Breathing step</span>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={1}
                    value={draftLedConfig.breathingStepMs}
                    onChange={(e) => setBreathingStepMs(Number(e.target.value))}
                  />
                  <span style={{ textAlign: "right" }}>{draftLedConfig.breathingStepMs} ms</span>
                </label>
              </div>
            )}
            {passiveMode === "Static" && (
              <label className="muted small" style={pickerRowStyle}>
                <span>Color</span>
                <input
                  type="color"
                  value={colorToHex(activeConfig.passiveColors[target])}
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
            value={activeConfig.activeModes[target]}
            onChange={(e) => setActiveMode(target, e.target.value as ActiveLedMode)}
          >
            <option value="Off">Off</option>
            <option value="Nothing">Nothing</option>
            <option value="Solid">Solid</option>
          </select>
          {modalActiveSolidEnabled && (
            <input
              type="color"
              value={colorToHex(activeConfig.activeColors[target])}
              onChange={(e) => setActiveColor(target, hexToColor(e.target.value))}
            />
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => copyLedLighting(target)}>Copy</button>
            <button className="btn" disabled={!copiedLedLighting} onClick={() => pasteLedLighting(target)}>Paste</button>
            <button className="btn" onClick={() => applyLightingToAll(target)}>Apply to all</button>
          </div>
          <div style={{ minHeight: "18px", textAlign: "right" }}>
            <span className="muted small">{lightingStatus}</span>
          </div>
        </div>
      </div>
    );
  };
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [devMode, setDevMode] = useState<boolean>(false);
  const [debugFirmware, setDebugFirmware] = useState<boolean>(false);
  const defaultDebugOptions: DebugOptionsDto = { enableNoiseFilter: true, enablePullups: true, confirmSamples: 3, confirmDelayMs: 1 };
  const classicDebugOptions: DebugOptionsDto = { enableNoiseFilter: false, enablePullups: false, confirmSamples: 1, confirmDelayMs: 0 };
  const [debugOptions, setDebugOptions] = useState<DebugOptionsDto>(defaultDebugOptions);
  const [selectedProfile, setSelectedProfile] = useState<KnownDeviceProfile | null>(null);
  const [rememberedBootloaderId, setRememberedBootloaderId] = useState<number[] | null>(null);
  const [currentBindings, setCurrentBindings] = useState<BindingProfileDto | null>(null);
  const [selectedLayout, setSelectedLayout] = useState<DeviceLayoutDto | null>(null);
  const [ledConfig, setLedConfig] = useState<LedConfigurationDto | null>(null);
  const [editorTarget, setEditorTarget] = useState<EditTarget | null>(null);
  const [editorBinding, setEditorBinding] = useState<HidBindingDto | null>(null);
  const [stepClipboard, setStepClipboard] = useState<HidStepDto[] | null>(null);
  const [showGlobalLightingModal, setShowGlobalLightingModal] = useState<boolean>(false);
  const [showLightingModal, setShowLightingModal] = useState<boolean>(false);
  const [focusLedIndex, setFocusLedIndex] = useState<number | null>(null);
  const [copiedLedLighting, setCopiedLedLighting] = useState<{ passiveMode: PassiveLedMode; passive: LedColor; activeMode: ActiveLedMode; activeColor: LedColor } | null>(null);
  const [draftLedConfig, setDraftLedConfig] = useState<LedConfigurationDto | null>(null);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [exportText, setExportText] = useState<string>("");
  const [exportCopyStatus, setExportCopyStatus] = useState<string>("");
  const [exportCopyFlash, setExportCopyFlash] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>("");
  const [importError, setImportError] = useState<string>("");
  const [showDemoModal, setShowDemoModal] = useState<boolean>(false);
  const [lastDemoKey, setLastDemoKey] = useState<string | null>(() => loadLastDemoKey());
  const [selectedDemoKey, setSelectedDemoKey] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const defaultLightingStatus = "Copy a key's lighting to paste or apply to all.";
  const modalPointerDownRef = useRef<boolean>(false);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, tone: Toast["tone"] = "info", durationMs = 3200) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ message, tone });
    toastTimerRef.current = window.setTimeout(() => setToast(null), durationMs);
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const clientRef = useRef<BootloaderClient | null>(null);
  const lastBootloaderIdRef = useRef<number[] | null>(null);
  const [hexDragOver, setHexDragOver] = useState(false);
  const [showConnectWizard, setShowConnectWizard] = useState<boolean>(false);
  const [connectWizardStep, setConnectWizardStep] = useState<number>(0);
  const [wizardHidden, setWizardHidden] = useState<boolean>(() => loadConnectWizardHidden());
  const [wizardShotPreview, setWizardShotPreview] = useState<{ src: string; alt: string; title: string } | null>(null);
  const [showWizardPrompt, setShowWizardPrompt] = useState<boolean>(false);
  const [wizardWarning, setWizardWarning] = useState<string | null>(null);

  const isWizardShotPreviewOpen = wizardShotPreview != null;
  const wizardPromptModal = useModalClosing(showWizardPrompt, useCallback(() => setShowWizardPrompt(false), []));
  const connectWizardModal = useModalClosing(showConnectWizard, useCallback(() => {
    setShowConnectWizard(false);
    setWizardWarning(null);
  }, []));
  const wizardShotModal = useModalClosing(isWizardShotPreviewOpen, useCallback(() => setWizardShotPreview(null), []));
  const demoModalClosing = useModalClosing(showDemoModal, useCallback(() => setShowDemoModal(false), []));
  const globalLightingModalClosing = useModalClosing(showGlobalLightingModal, useCallback(() => {
    setShowGlobalLightingModal(false);
    setDraftLedConfig(null);
  }, []));
  const lightingModalClosing = useModalClosing(showLightingModal, useCallback(() => {
    setShowLightingModal(false);
    setDraftLedConfig(null);
    setFocusLedIndex(null);
    setLightingStatus(defaultLightingStatus);
  }, [defaultLightingStatus]));
  const exportModalClosing = useModalClosing(showExportModal, useCallback(() => setShowExportModal(false), []));
  const importModalClosing = useModalClosing(showImportModal, useCallback(() => {
    setShowImportModal(false);
    setImportError("");
  }, []));

  const { isClosing: wizardPromptClosing, requestClose: requestWizardPromptClose, handleAnimationEnd: handleWizardPromptAnimationEnd } = wizardPromptModal;
  const { isClosing: connectWizardClosing, requestClose: requestConnectWizardClose, handleAnimationEnd: handleConnectWizardAnimationEnd } = connectWizardModal;
  const { isClosing: wizardShotClosing, requestClose: requestWizardShotClose, handleAnimationEnd: handleWizardShotAnimationEnd } = wizardShotModal;
  const { isClosing: demoModalClosingState, requestClose: requestDemoModalClose, handleAnimationEnd: handleDemoModalAnimationEnd } = demoModalClosing;
  const { isClosing: globalLightingClosing, requestClose: requestGlobalLightingClose, handleAnimationEnd: handleGlobalLightingAnimationEnd } = globalLightingModalClosing;
  const { isClosing: lightingClosing, requestClose: requestLightingClose, handleAnimationEnd: handleLightingAnimationEnd } = lightingModalClosing;
  const { isClosing: exportModalClosingState, requestClose: requestExportModalClose, handleAnimationEnd: handleExportModalAnimationEnd } = exportModalClosing;
  const { isClosing: importModalClosingState, requestClose: requestImportModalClose, handleAnimationEnd: handleImportModalAnimationEnd } = importModalClosing;

  const shouldShowConnectSpinner = status.state === "requesting" && !showConnectWizard;
  const [connectSpinnerOpen, setConnectSpinnerOpen] = useState<boolean>(false);
  const connectSpinnerModal = useModalClosing(connectSpinnerOpen, useCallback(() => setConnectSpinnerOpen(false), []));
  const { isClosing: connectSpinnerClosing, requestClose: requestConnectSpinnerClose, handleAnimationEnd: handleConnectSpinnerAnimationEnd } = connectSpinnerModal;

  const openWizardShotPreview = useCallback((src: string, alt: string, title: string) => {
    setWizardShotPreview({ src, alt, title });
  }, []);

  const updateWizardHidden = useCallback((hidden: boolean) => {
    setWizardHidden(hidden);
    saveConnectWizardHidden(hidden);
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
    const passiveModes: PassiveLedMode[] = Array.from({ length: count }, () => "Rainbow");
    const passiveColors: LedColor[] = Array.from({ length: count }, (_, idx) => {
      const seq: LedColor[] = [
        { r: 255, g: 0, b: 0 },
        { r: 255, g: 255, b: 0 },
        { r: 0, g: 255, b: 0 },
      ];
      return seq[idx % seq.length];
    });
    const activeColors: LedColor[] = Array.from({ length: count }, () => ({ r: 255, g: 255, b: 255 }));
    const activeModes: ActiveLedMode[] = Array.from({ length: count }, () => "Solid");
    return {
      passiveModes,
      passiveColors,
      activeModes,
      activeColors,
      brightnessPercent: 100,
      rainbowStepMs: 20,
      breathingMinPercent: 20,
      breathingStepMs: 20,
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
    if (config.passiveModes.length !== count
      || config.passiveColors.length !== count
      || config.activeModes.length !== count
      || config.activeColors.length !== count) {
      throw new Error(`Lighting configuration must have ${count} entries for this layout.`);
    }
    return config;
  }, [ledCountFromLayout]);

  const webUsbAvailable = CH55xBootloader.isWebUsbAvailable();
  const secure = typeof window !== "undefined" ? window.isSecureContext : true;
  const isWindows = typeof navigator !== "undefined" && /windows/i.test(navigator.userAgent);

  const defaultDemoKey = "144-165-233-190"; // 6 Keys 1 Knob

  const demoOptions = useMemo(() => DEVICE_PROFILES
    .filter((profile) => !profile.hideFromDemo)
    .flatMap((profile) => profile.bootloaderIds.map((bootloaderKey) => ({
      key: bootloaderKey,
      name: profile.name,
      bootloaderId: bootloaderKey.split("-").map((n) => Number(n)).filter((n) => Number.isFinite(n)),
    }))), []);

  const connectWizardSteps: ConnectWizardStep[] = useMemo(() => {
    const steps: ConnectWizardStep[] = [];
    steps.push({ id: "keypad", title: "Get a keypad" });
    if (isWindows) {
      steps.push({ id: "windows-driver", title: "Install driver" });
    }
    steps.push({ id: "bootloader", title: "Enter bootloader mode" });
    steps.push({ id: "connect", title: "Connect" });
    return steps;
  }, [isWindows]);

  const bootloaderStepIndex = useMemo(
    () => connectWizardSteps.findIndex((step) => step.id === "bootloader"),
    [connectWizardSteps],
  );
  const connectStepIndex = useMemo(
    () => connectWizardSteps.findIndex((step) => step.id === "connect"),
    [connectWizardSteps],
  );

  const renderWizardStepBody = useCallback((step: ConnectWizardStep | null): ReactNode => {
    if (!step) return null;
    const renderWizardShot = (src: string, title: string) => (
      <button
        type="button"
        className="wizard-shot"
        onClick={() => openWizardShotPreview(src, title, title)}
      >
        <img src={src} alt={title} loading="lazy" />
        <div className="wizard-shot-caption">{title}</div>
      </button>
    );
    if (step.id === "keypad") {
      return (
        <div className="wizard-grid">
          <div className="wizard-copy">
            <p className="wizard-foreword">You will need to have a compatible keypad to use this project.</p>
            <p className="wizard-foreword">If you don't have one yet, here are some tips to get the right one:</p>
            <ul className="wizard-list">
              <li>
                <strong>Pick a supported device</strong>
                <ul className="wizard-sublist">
                  <li>Browse the <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher#supported-devices" target="_blank" rel="noreferrer">supported devices list</a> to see all currently supported keypads</li>
                  <li>Other keypads not on this list may be compatible, but will need to be added to this project first. See the <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher/blob/main/docs/development.md#adding-support-for-new-keypads" target="_blank" rel="noreferrer">developer instructions</a> for how to add support for new devices</li>
                </ul>
              </li>
              <li>
                <strong>Avoid incompatible boards</strong>
                <ul className="wizard-sublist">
                  <li>Some keypads use incompatible boards such as the CH57x or CH32 microcontrollers</li>
                  <li>See the <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher#unsupported-devices" target="_blank" rel="noreferrer">unsupported devices</a> documentation for more information</li>
                </ul>
              </li>
              <li>
                <strong>Lighting controls</strong>
                <ul className="wizard-sublist">
                  <li>Some keypads come with fixed or non-standard LEDs, so lighting controls may be limited on these devices</li>
                </ul>
              </li>
              <li>
                <strong>Bootloader mode</strong>
                <ul className="wizard-sublist">
                  <li>You will need to be able to enter bootloader mode on your keypad to flash the firmware</li>
                  <li>This is covered in more detail in the next step, but be aware before you get a keypad that you may need to purchase or build a bootloader adapter for most keypads</li>
                  <li>An <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher/blob/main/docs/bootloader.md#official-adapter" target="_blank" rel="noreferrer">official bootloader adapter</a> is available for purchase to make it as easy as possible to use</li>
                </ul>
              </li>
            </ul>
          </div>
          <div className="wizard-placeholders">
            {renderWizardShot("/img/keypads.jpg", "Examples of supported keypads")}
          </div>
        </div>
      );
    }
    if (step.id === "windows-driver") {
      return (
        <div className="wizard-grid">
          <div className="wizard-copy">
            <p className="wizard-foreword">Windows requires a driver to be installed before the browser can recognize the device in bootloader mode. Linux / macOS devices do not require this step.</p>
            <p>If you have already installed the driver please skip to the next step. You only need to install it once as a one-time setup for all keypads.</p>
            <ol className="wizard-list">
              <li>Download <a className="link" href="https://zadig.akeo.ie/" target="_blank" rel="noreferrer">Zadig</a> and open it. Administrative privileges may be required</li>
              <li>Press <strong>Device → Create New Device</strong></li>
              <li>Set name to "CH55x Bootloader" and the USB ID to <code>4348</code> <code>55E0</code></li>
              <li>Ensure the WinUSB driver is selected, it should be by default anyway</li>
              <li>Press <strong>Install Driver</strong>, this may take a few minutes</li>
            </ol>
          </div>
          <div className="wizard-placeholders">
            {renderWizardShot("/img/zadig-1.png", "Zadig driver setup part 1")}
            {renderWizardShot("/img/zadig-2.png", "Zadig driver setup part 2")}
          </div>
        </div>
      );
    }

    if (step.id === "bootloader") {
      return (
        <div className="wizard-grid">
          <div className="wizard-copy">
            <p className="wizard-foreword">Get the keypad into bootloader mode so the flasher can communicate with it.</p>
            <ul className="wizard-list">
              <li>
                <strong>Keypad buttons</strong>
                <ul className="wizard-sublist">
                  <li>If you've flashed this firmware previously, you can use your configured bootloader buttons to enter bootloader mode easily</li>
                  <li>The default configuration is to press the first dial (or button if no dial) while plugging in. If you have more than 2 buttons you can also press all of them at any time as well</li>
                  <li>Check the <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher/blob/main/docs/bootloader.md#bootloader-buttons" target="_blank" rel="noreferrer">bootloader buttons guide</a> if you wish to customize the bootloader entry</li>
                </ul>
              </li>
              <li>
                <strong>Use the <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher/blob/main/docs/bootloader.md#official-adapter" target="_blank" rel="noreferrer">official adapter</a> (recommended)</strong>
                <ul className="wizard-sublist">
                  <li>Connect the adapter to your device and the keypad to the adapter's USB receptacle</li>
                  <li>Hold BOOT, tap RESET once, then release BOOT again</li>
                </ul>
              </li>
              <li>
                <strong>Use built-in keypad jumpers</strong>
                <ul className="wizard-sublist">
                  <li>Some keypads have jumper pads that can be shorted to enter bootloader mode</li>
                  <li>Check the <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher/blob/main/docs/bootloader.md#devices" target="_blank" rel="noreferrer">devices guide</a> to see if your keypad supports this and how to do it</li>
                </ul>
              </li>
              <li>
                <strong>DIY adapter</strong>
                <ul className="wizard-sublist">
                  <li>You can also build your own adapter to enter bootloader mode if you can't or prefer not to buy the official adapter for any reason</li>
                  <li>This may also be a preferable option if you have electronics experience and most of the necessary parts already to hand</li>
                  <li>See the <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher/blob/main/docs/bootloader.md#diy-adapter" target="_blank" rel="noreferrer">DIY adapter guide</a> for instructions on how to build one</li>
                </ul>
              </li>
            </ul>
            <div className="muted small">You will have about 10 seconds to connect after entering bootloader mode or you'll need to try again.</div>
          </div>
          <div className="wizard-placeholders">
            {renderWizardShot("/img/bootloader-button.jpg", "Bootloader entry with adapter buttons")}
            {renderWizardShot("/img/official-adapter.jpg", "Official CH55x bootloader adapter")}
          </div>
        </div>
      );
    }

    return (
      <div className="wizard-connect">
        <ConnectSpinner inline />
      </div>
    );
  }, [openWizardShotPreview]);

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
    const lastId = loadLastBootloaderId();
    if (!lastId) return;
    setRememberedBootloaderId(lastId);
    const profile = findProfileForBootloaderId(lastId);
    setSelectedProfile(profile);
    const stored = loadStoredConfig(lastId);
    const nextLayout = stored?.layout ?? (profile?.layout ? cloneLayout(profile.layout) : null);
    const nextBindings = stored?.bindings ?? profile?.defaultBindings ?? null;
    setSelectedLayout(nextLayout);
    setCurrentBindings(nextBindings);
    try {
      const pickedLedConfig = pickLedConfigForLayout(nextLayout, stored?.ledConfig ?? null);
      const validatedLedConfig = assertLedConfigMatchesLayout(nextLayout, pickedLedConfig);
      setLedConfig(validatedLedConfig);
    } catch (err) {
      setStatus({ state: "error", detail: String((err as Error).message ?? err) });
    }
  }, [assertLedConfigMatchesLayout, pickLedConfigForLayout]);

  const applyConnectedDevice = useCallback((info: ConnectedInfo, options: { source: "real" | "demo"; persistLastId: boolean }) => {
    const previousId = lastBootloaderIdRef.current;
    const sameDevice = sameBootloaderId(previousId, info.id);

    if (options.persistLastId) {
      lastBootloaderIdRef.current = info.id;
    }

    setConnectedInfo(info);
    const profile = findProfileForBootloaderId(info.id);
    setSelectedProfile(profile);

    if (options.persistLastId) {
      setRememberedBootloaderId(info.id);
      saveLastBootloaderId(info.id);
    }

    const stored = loadStoredConfig(info.id);
    if (!sameDevice || !selectedLayout) {
      const nextLayout = stored?.layout ?? (profile?.layout ? cloneLayout(profile.layout) : null);
      setSelectedLayout(nextLayout);
    }

    const nextBindings = stored?.bindings ?? profile?.defaultBindings ?? null;
    if (!sameDevice || !currentBindings) {
      setCurrentBindings(nextBindings);
    }

    const nextLayout = (!sameDevice || !selectedLayout) ? (stored?.layout ?? (profile?.layout ? cloneLayout(profile.layout) : null)) : selectedLayout;
    try {
      const pickedLedConfig = pickLedConfigForLayout(nextLayout, stored?.ledConfig ?? null);
      const validatedLedConfig = assertLedConfigMatchesLayout(nextLayout, pickedLedConfig);
      setLedConfig(validatedLedConfig);
    } catch (err) {
      setStatus({ state: "error", detail: String((err as Error).message ?? err) });
    }

    const detail = profile
      ? `${options.source === "demo" ? "Demo: " : ""}${profile.name}`
      : (options.source === "demo" ? "Demo device" : undefined);
    setStatus(profile ? { state: "connectedKnown", detail } : { state: "connectedUnknown", detail });
  }, [assertLedConfigMatchesLayout, currentBindings, pickLedConfigForLayout, selectedLayout]);

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
    setSelectedLayout(nextLayout);
    setCurrentBindings(nextBindings);
    try {
      const pickedLedConfig = pickLedConfigForLayout(nextLayout, stored?.ledConfig ?? null);
      const validatedLedConfig = assertLedConfigMatchesLayout(nextLayout, pickedLedConfig);
      setLedConfig(validatedLedConfig);
    } catch (err) {
      setStatus({ state: "error", detail: String((err as Error).message ?? err) });
    }
  }, [assertLedConfigMatchesLayout, pickLedConfigForLayout, rememberedBootloaderId]);

  const disconnectClient = useCallback(async (nextStatus?: Status, reboot?: boolean) => {
    const client = clientRef.current;
    if (client) {
      if (reboot) {
        await client.runApplication().catch(() => {});
      }
      await client.disconnect().catch(() => {});
    }
    clientRef.current = null;
    setDemoMode(false);
    setConnectedInfo(null);
    setProgress({ phase: "", current: 0, total: 0 });
    restoreSavedConfig();
    if (nextStatus) setStatus(nextStatus);
  }, [restoreSavedConfig]);

  const handlePassiveDisconnect = useCallback(async (detail?: string) => {
    await disconnectClient({ state: "deviceLost", detail: detail ?? "Device disconnected. Reconnect to continue." });
  }, [disconnectClient]);

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

  const startDemo = useCallback(async () => {
    const chosen = demoOptions.find((opt) => opt.key === selectedDemoKey) ?? demoOptions[0];
    if (!chosen) {
      setStatus({ state: "error", detail: "No demo devices available." });
      return;
    }

    try {
      requestDemoModalClose();
      setStatus({ state: "requesting", detail: "Starting demo…" });
      if (clientRef.current) {
        await clientRef.current.disconnect().catch(() => {});
      }
      const client = new FakeBootloader({ bootloaderId: chosen.bootloaderId });
      clientRef.current = client;
      const info = await client.connect();
      setDemoMode(true);
      setLastDemoKey(chosen.key);
      saveLastDemoKey(chosen.key);
      applyConnectedDevice(info, { source: "demo", persistLastId: false });
    } catch (err) {
      clientRef.current = null;
      setDemoMode(false);
      setStatus({ state: "error", detail: String((err as Error).message ?? "Failed to start demo mode.") });
    }
  }, [applyConnectedDevice, demoOptions, selectedDemoKey]);

  const handleDemoToggle = useCallback(async () => {
    if (demoMode) {
      await disconnectClient({ state: "idle" });
      return;
    }
    setShowDemoModal(true);
  }, [demoMode, disconnectClient]);

  const performConnect = useCallback(async (options?: { origin?: "wizard" | "direct" }) => {
    const origin = options?.origin ?? "direct";
    if (!webUsbAvailable) {
      setStatus({ state: "error", detail: "WebUSB not available in this browser." });
      return;
    }
    try {
      setStatus({ state: "requesting" });
      setWizardWarning(null);
      if (demoMode && clientRef.current) {
        await clientRef.current.disconnect().catch(() => {});
      }

      const existing = clientRef.current;
      const client = existing instanceof CH55xBootloader ? existing : new CH55xBootloader();
      clientRef.current = client;

      setDemoMode(false);
      const info = await client.connect();
      applyConnectedDevice(info, { source: "real", persistLastId: true });
    } catch (e) {
      const msg = normalizeUsbErrorMessage(String((e as Error).message ?? e));
      if (origin === "wizard") {
        const warning = msg.startsWith("No device selected")
          ? "No device selected. Please make sure your device is in bootloader mode and try again."
          : msg;
        setWizardWarning(warning);
        setConnectWizardStep(bootloaderStepIndex >= 0 ? bootloaderStepIndex : 0);
        setShowConnectWizard(true);
        setStatus({ state: "error", detail: msg });
        return;
      }
      if (wizardHidden && msg.startsWith("No device selected")) {
        setShowWizardPrompt(true);
        setStatus({ state: "idle" });
        return;
      }
      setStatus({ state: "error", detail: msg });
    }
  }, [webUsbAvailable, demoMode, applyConnectedDevice, wizardHidden, bootloaderStepIndex]);

  const openConnectWizard = useCallback(() => {
    setWizardWarning(null);
    setConnectWizardStep(0);
    setShowConnectWizard(true);
  }, []);

  const handleConnectClick = useCallback(() => {
    if (wizardHidden) {
      void performConnect();
      return;
    }
    openConnectWizard();
  }, [wizardHidden, performConnect, openConnectWizard]);

  const startWizardConnect = useCallback(() => {
    setWizardWarning(null);
    setShowConnectWizard(true);
    setConnectWizardStep(connectStepIndex >= 0 ? connectStepIndex : 0);
    void performConnect({ origin: "wizard" });
  }, [connectStepIndex, performConnect]);

  const handleDisconnect = useCallback(async () => {
    await disconnectClient({ state: "idle" }, true);
  }, [disconnectClient]);

  const flashBytes = useCallback(async (bytes: Uint8Array) => {
    const client = clientRef.current;
    if (!client) {
      setStatus({ state: "needConnect" });
      return;
    }

    try {
      setStatus({ state: "flashing" });
      await client.flashBinary(bytes, (p) => setProgress(p));
      setStatus({ state: "flashDone" });
      await disconnectClient();
    } catch (e) {
      setStatus({ state: "flashError", detail: String((e as Error).message ?? e) });
    } finally {
      setProgress({ phase: "", current: 0, total: 0 });
    }
  }, [disconnectClient]);

  useEffect(() => {
    if (demoMode) return;
    const targetId = connectedInfo?.id ?? rememberedBootloaderId ?? lastBootloaderIdRef.current;
    if (!targetId) return;
    saveStoredConfig(targetId, { bindings: currentBindings, layout: selectedLayout, ledConfig });
  }, [connectedInfo, rememberedBootloaderId, currentBindings, selectedLayout, ledConfig, demoMode]);

  useEffect(() => {
    if (!webUsbAvailable || typeof navigator === "undefined" || !navigator.usb) return;
    const onUsbDisconnect = (event: USBConnectionEvent) => {
      const connected = clientRef.current?.getConnectedDevice();
      if (!connected) return;
      const sameDevice = event.device === connected
        || (event.device.vendorId === connected.vendorId && event.device.productId === connected.productId && event.device.serialNumber === connected.serialNumber);
      if (sameDevice) {
        void handlePassiveDisconnect("Device disconnected. Reconnect to continue.");
      }
    };
    navigator.usb.addEventListener("disconnect", onUsbDisconnect);
    return () => navigator.usb.removeEventListener("disconnect", onUsbDisconnect);
  }, [webUsbAvailable, handlePassiveDisconnect]);

  useEffect(() => {
    if (demoMode) return;
    if (!connectedInfo || !clientRef.current) return;
    if (status.state === "flashing" || status.state === "compiling" || status.state === "requesting") return;
    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      if (cancelled) return;
      try {
        await clientRef.current?.ping();
      } catch {
        if (cancelled) return;
        await handlePassiveDisconnect("Device became inactive. Reconnect to continue.");
      }
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [connectedInfo, status.state, handlePassiveDisconnect, demoMode]);

  const handleHexDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!hexDragOver) setHexDragOver(true);
  }, [hexDragOver]);

  const handleHexDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    if (hexDragOver) setHexDragOver(false);
  }, [hexDragOver]);

  const processHexFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const { data } = parseIntelHexBrowser(text, 63 * 1024);
      await flashBytes(data);
    } catch (err) {
      setStatus({ state: "flashError", detail: String((err as Error).message ?? err) });
    }
  }, [flashBytes]);

  const handleHexDrop = useCallback(async (event: DragEvent) => {
    event.preventDefault();
    setHexDragOver(false);
    if (!clientRef.current) {
      setStatus({ state: "needConnect" });
      return;
    }
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    await processHexFile(file);
  }, [processHexFile]);

  const handleHexClick = useCallback(() => {
    if (!clientRef.current) {
      setStatus({ state: "needConnect" });
      return;
    }
    if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
      setStatus({ state: "fileApiMissing" });
      return;
    }
    fileInputRef.current?.click();
  }, []);

  const onHexFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processHexFile(file);
    event.target.value = "";
  }, [processHexFile]);

  const compileAndFlash = useCallback(async () => {
    if (!selectedLayout && !debugFirmware) {
      setStatus({ state: "unsupported", detail: "Device not recognized. Use debug firmware or check supported layouts." });
      return;
    }

    if (selectedLayout && !currentBindings) {
      setStatus({ state: "unsupported", detail: "Bindings missing for detected layout." });
      return;
    }

    try {
      setStatus({ state: "compiling", detail: debugFirmware ? "Debug firmware" : selectedProfile?.name });
      const requestLedConfig = debugFirmware ? null : assertLedConfigMatchesLayout(selectedLayout, ledConfig);
      const sanitizedDebugOptions: DebugOptionsDto = {
        enableNoiseFilter: debugOptions.enableNoiseFilter,
        enablePullups: debugOptions.enablePullups,
        confirmSamples: Math.max(1, Math.min(255, Math.round(debugOptions.confirmSamples))),
        confirmDelayMs: Math.max(0, Math.min(255, Math.round(debugOptions.confirmDelayMs))),
      };
      const payload: FirmwareRequestBody = debugFirmware
        ? { layout: null, bindingProfile: null, debug: true, ledConfig: null, debugOptions: sanitizedDebugOptions }
        : { layout: selectedLayout, bindingProfile: currentBindings, debug: false, ledConfig: requestLedConfig, debugOptions: null };

      const resp = await fetch("flasher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let respBody: { error?: string; exitCode?: number; stdout?: string; stderr?: string; fileBytes?: string; } = {};
      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try { respBody = await resp.json(); } catch { /* ignore parse errors */ }
      } else if (resp.ok) {
        respBody = await resp.json().catch(() => null);
      }

      if (!resp.ok) {
        if (respBody && respBody.error) {
          const exitCode = respBody.exitCode != null ? ` (exit ${respBody.exitCode})` : "";
          const stdout = respBody.stdout ? `\n--- stdout ---\n${respBody.stdout.trim()}` : "";
          const stderr = respBody.stderr ? `\n--- stderr ---\n${respBody.stderr.trim()}` : "";
          setStatus({ state: "compileError", detail: `Compile failed${exitCode}: ${respBody.error}${stdout}${stderr}` });
          return;
        }
        throw new Error(`Compile failed: ${resp.status} ${resp.statusText}`);
      }

      if (!respBody || !respBody.fileBytes) {
        throw new Error("Unexpected compile response format.");
      }

      const base64: string = respBody.fileBytes;
      const text = atob(base64);
      const { data } = parseIntelHexBrowser(text, 63 * 1024);
      await flashBytes(data);
    } catch (err) {
      setStatus({ state: "compileError", detail: String((err as Error).message ?? err) });
    }
  }, [assertLedConfigMatchesLayout, flashBytes, debugFirmware, debugOptions, selectedLayout, selectedProfile, currentBindings, ledConfig]);

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

  const cloneLedConfig = (config: LedConfigurationDto): LedConfigurationDto => ({
    passiveModes: [...config.passiveModes],
    passiveColors: [...config.passiveColors],
    activeModes: [...config.activeModes],
    activeColors: [...config.activeColors],
    brightnessPercent: config.brightnessPercent,
    rainbowStepMs: config.rainbowStepMs,
    breathingMinPercent: config.breathingMinPercent,
    breathingStepMs: config.breathingStepMs,
  });

  const ledDisplayName = (idx: number): string => {
    const btn = userButtons.find((b) => b.ledIndex === idx);
    if (btn) return `Button ${btn.id + 1}`;
    return `Unmapped LED ${idx + 1}`;
  };

  const openExportModal = useCallback(() => {
    if (!currentBindings) {
      setStatus({ state: "error", detail: "Nothing to export yet. Connect a device and load bindings first." });
      return;
    }
    if (!selectedLayout) {
      setStatus({ state: "error", detail: "Layout not ready yet. Connect a device before exporting." });
      return;
    }
    const targetId = connectedInfo?.id ?? rememberedBootloaderId ?? lastBootloaderIdRef.current;
    if (!targetId) {
      setStatus({ state: "error", detail: "Connect a device before exporting." });
      return;
    }
    try {
      const payload = {
        version: 1,
        deviceId: targetId,
        profile: selectedProfile?.name ?? null,
        exportedAt: new Date().toISOString(),
        bindings: currentBindings,
        bootloaderConfig: bootloaderConfigFromLayout(selectedLayout),
        ledConfig: assertLedConfigMatchesLayout(selectedLayout, ledConfig),
      };
      const text = JSON.stringify(payload, null, 2);
      setExportText(text);
      setExportCopyStatus("Click the code to copy.");
      setShowExportModal(true);
    } catch (err) {
      setStatus({ state: "error", detail: String((err as Error).message ?? err) });
    }
  }, [assertLedConfigMatchesLayout, connectedInfo, currentBindings, ledConfig, rememberedBootloaderId, selectedLayout, selectedProfile]);

  const handleExportCopy = useCallback(async () => {
    if (!exportText) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(exportText);
        setExportCopyStatus("Copied to clipboard.");
        setExportCopyFlash(true);
        window.setTimeout(() => setExportCopyFlash(false), 220);
        showToast("Export copied", "success", 2600);
        return;
      }
      setExportCopyStatus("Clipboard not available. Copy manually.");
      showToast("Clipboard not available. Copy manually.", "warn", 3200);
    } catch (err) {
      setExportCopyStatus(`Copy failed: ${String((err as Error).message ?? err)}`);
      showToast("Copy failed", "error", 3200);
    }
  }, [exportText, showToast]);

  const openImportModal = useCallback(() => {
    setImportText("");
    setImportError("");
    setShowImportModal(true);
  }, []);

  const parseImportedConfig = useCallback((text: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Invalid JSON. Paste a configuration export.");
    }
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Unsupported configuration format.");
    }
    const parsedConfig = parsed as {
      version?: unknown;
      deviceId?: unknown;
      bindings?: unknown;
      bootloaderConfig?: unknown;
      ledConfig?: unknown;
    };
    const version = parsedConfig.version ?? 1;
    if (version !== 1) {
      throw new Error("Unsupported configuration format.");
    }
    const targetId = connectedInfo?.id ?? rememberedBootloaderId ?? lastBootloaderIdRef.current;
    if (!targetId) throw new Error("Connect a device before importing.");
    const rawId = parsedConfig.deviceId ?? null;
    if (!Array.isArray(rawId) || !rawId.every((n): n is number => typeof n === "number")) {
      throw new Error("Import missing device id.");
    }
    if (!sameBootloaderId(rawId, targetId)) {
      throw new Error("This configuration is for a different device. Connect the matching device to import.");
    }
    const bindings = parsedConfig.bindings ? validateBindingProfileCandidate(parsedConfig.bindings) : null;
    if (!bindings) throw new Error("Import is missing bindings.");
    const baseLayout = selectedLayout ? cloneLayout(selectedLayout) : null;
    if (!baseLayout) throw new Error("Layout not loaded for this device. Connect again and retry import.");

    const bootCfg = parsedConfig.bootloaderConfig ? validateBootloaderConfigCandidate(parsedConfig.bootloaderConfig) : null;
    if (!bootCfg) throw new Error("Import missing bootloader configuration.");
    const layoutWithBootloader = applyBootloaderConfigToLayout(baseLayout, bootCfg);

    const ledCfg = parsedConfig.ledConfig ? validateLedConfigCandidate(parsedConfig.ledConfig) : null;
    const validatedLed = assertLedConfigMatchesLayout(layoutWithBootloader, ledCfg);
    return { bindings, ledConfig: validatedLed, layout: layoutWithBootloader };
  }, [assertLedConfigMatchesLayout, connectedInfo, rememberedBootloaderId, selectedLayout]);

  const applyImportedConfig = useCallback((text: string) => {
    try {
      const next = parseImportedConfig(text);
      setSelectedLayout(next.layout);
      setCurrentBindings(next.bindings);
      setLedConfig(next.ledConfig);
      const targetId = connectedInfo?.id ?? rememberedBootloaderId ?? lastBootloaderIdRef.current;
      if (targetId) {
        saveStoredConfig(targetId, { bindings: next.bindings, layout: next.layout, ledConfig: next.ledConfig });
      }
      requestImportModalClose();
      setImportError("");
      showToast("Configuration imported", "success", 20000);
    } catch (err) {
      setImportError(String((err as Error).message ?? err));
    }
  }, [parseImportedConfig, connectedInfo, rememberedBootloaderId, selectedLayout, showToast]);

  const closeGlobalLightingModal = () => {
    requestGlobalLightingClose();
  };

  const saveGlobalLightingModal = () => {
    if (draftLedConfig) {
      setLedConfig(draftLedConfig);
    }
    closeGlobalLightingModal();
  };

  const openGlobalLightingModal = () => {
    if (!ledConfig) return;
    setDraftLedConfig(cloneLedConfig(ledConfig));
    setLightingStatus(defaultLightingStatus);
    setFocusLedIndex(null);
    setShowGlobalLightingModal(true);
  };

  const closeLightingModal = () => {
    requestLightingClose();
  };
  const saveLightingModal = () => {
    if (draftLedConfig) {
      setLedConfig(draftLedConfig);
    }
    closeLightingModal();
  };
  const openLightingForLed = (idx: number) => {
    if (!ledConfig || idx < 0 || idx >= ledConfig.passiveColors.length) return;
    setDraftLedConfig(cloneLedConfig(ledConfig));
    setLightingStatus(defaultLightingStatus);
    setFocusLedIndex(idx);
    setShowLightingModal(true);
  };

  useEffect(() => {
    if (!showLightingModal) return;
    if (focusLedIndex == null) return;
    const el = document.getElementById(`led-card-${focusLedIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [showLightingModal, focusLedIndex]);

  const setPassiveColor = (idx: number, color: LedColor) => {
    setDraftLedConfig((prev) => {
      if (!prev || idx < 0 || idx >= prev.passiveColors.length) return prev;
      const next = [...prev.passiveColors];
      next[idx] = color;
      return { ...prev, passiveColors: next };
    });
  };

  const setPassiveModeForLed = (idx: number, mode: PassiveLedMode) => {
    setDraftLedConfig((prev) => {
      if (!prev || idx < 0 || idx >= prev.passiveModes.length) return prev;
      const passiveModes = [...prev.passiveModes];
      passiveModes[idx] = mode;
      return { ...prev, passiveModes };
    });
  };
  const setActiveMode = (idx: number, mode: ActiveLedMode) => {
    setDraftLedConfig((prev) => {
      if (!prev || idx < 0 || idx >= prev.activeModes.length) return prev;
      const next = [...prev.activeModes];
      next[idx] = mode;
      return { ...prev, activeModes: next };
    });
  };

  const setActiveColor = (idx: number, color: LedColor) => {
    setDraftLedConfig((prev) => {
      if (!prev || idx < 0 || idx >= prev.activeColors.length) return prev;
      const next = [...prev.activeColors];
      next[idx] = color;
      return { ...prev, activeColors: next };
    });
  };

  const setBrightnessPercent = (value: number) => {
    setDraftLedConfig((prev) => (prev ? { ...prev, brightnessPercent: value } : prev));
  };

  const setRainbowStepMs = (value: number) => {
    setDraftLedConfig((prev) => (prev ? { ...prev, rainbowStepMs: value } : prev));
  };

  const setBreathingMinPercent = (value: number) => {
    setDraftLedConfig((prev) => (prev ? { ...prev, breathingMinPercent: value } : prev));
  };

  const setBreathingStepMs = (value: number) => {
    setDraftLedConfig((prev) => (prev ? { ...prev, breathingStepMs: value } : prev));
  };

  const [lightingStatus, setLightingStatus] = useState<string>(defaultLightingStatus);

  const copyLedLighting = (idx: number) => {
    const source = draftLedConfig;
    if (!source || idx < 0 || idx >= source.passiveColors.length || idx >= source.activeModes.length || idx >= source.activeColors.length || idx >= source.passiveModes.length) return;
    const label = ledDisplayName(idx);
    setCopiedLedLighting({
      passiveMode: source.passiveModes[idx],
      passive: source.passiveColors[idx],
      activeMode: source.activeModes[idx],
      activeColor: source.activeColors[idx],
    });
    setLightingStatus(`Copied lighting from ${label}. Paste or apply to all.`);
  };

  const pasteLedLighting = (idx: number) => {
    setDraftLedConfig((prev) => {
      if (!prev || !copiedLedLighting || idx < 0 || idx >= prev.passiveColors.length || idx >= prev.activeModes.length || idx >= prev.activeColors.length || idx >= prev.passiveModes.length) return prev;
      const passiveColors = [...prev.passiveColors];
      const passiveModes = [...prev.passiveModes];
      const activeModes = [...prev.activeModes];
      const activeColors = [...prev.activeColors];
      passiveModes[idx] = copiedLedLighting.passiveMode;
      passiveColors[idx] = copiedLedLighting.passive;
      activeModes[idx] = copiedLedLighting.activeMode;
      activeColors[idx] = copiedLedLighting.activeColor;
      return { ...prev, passiveModes, passiveColors, activeModes, activeColors };
    });
    setLightingStatus(`Pasted lighting to ${ledDisplayName(idx)}.`);
  };

  const applyLightingToAll = (sourceIdx: number) => {
    setDraftLedConfig((prev) => {
      if (!prev || sourceIdx < 0 || sourceIdx >= prev.passiveColors.length || sourceIdx >= prev.activeModes.length || sourceIdx >= prev.activeColors.length || sourceIdx >= prev.passiveModes.length) return prev;
      const passiveMode = prev.passiveModes[sourceIdx];
      const passive = prev.passiveColors[sourceIdx];
      const activeMode = prev.activeModes[sourceIdx];
      const activeColor = prev.activeColors[sourceIdx];
      return {
        ...prev,
        passiveModes: prev.passiveModes.map(() => passiveMode),
        passiveColors: prev.passiveColors.map(() => passive),
        activeModes: prev.activeModes.map(() => activeMode),
        activeColors: prev.activeColors.map(() => activeColor),
      };
    });
    setLightingStatus(`Applied lighting from ${ledDisplayName(sourceIdx)} to all.`);
  };

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
        return { tone: "info" as const, title: "Requesting device…", body: "Approve the WebUSB prompt to continue." };
      case "connectedKnown":
        return { tone: "success" as const, title: `Connected: ${status.detail ?? "Device detected"}`, body: "Ready to compile and flash." };
      case "connectedUnknown":
        return { tone: "warn" as const, title: "Device not recognized", body: "Use debug firmware or pick a supported layout." };
      case "compiling":
        return { tone: "info" as const, title: "Compiling firmware…", body: status.detail ? `Building ${status.detail}.` : undefined, showSpinner: true };
      case "unsupported":
        return { tone: "warn" as const, title: "Unknown device", body: status.detail };
      case "flashing":
        return { tone: "info" as const, title: "Flashing firmware…", body: "Keep the device connected until it finishes." };
      case "flashDone":
        return { tone: "success" as const, title: "Flash finished", body: "Reconnect the device before flashing again." };
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

      const hasWizardSteps = connectWizardSteps.length > 0;
      const wizardStepIndex = hasWizardSteps ? Math.min(connectWizardStep, connectWizardSteps.length - 1) : 0;
      const activeWizardStep = hasWizardSteps ? connectWizardSteps[wizardStepIndex] : null;
      const wizardHasPrev = wizardStepIndex > 0;
      const wizardHasNext = wizardStepIndex < connectWizardSteps.length - 1;
      const wizardConnectStep = activeWizardStep?.id === "connect";

  const statusProgress = progress.total > 0 ? progress : null;

  const wizardPrimaryLabel = (() => {
    if (activeWizardStep?.id === "bootloader") return "Connect";
    if (activeWizardStep?.id === "connect") return "Retry connect";
    return wizardHasNext ? "Next" : "Connect";
  })();

  const handleWizardPrimary = () => {
    if (activeWizardStep?.id === "bootloader" || activeWizardStep?.id === "connect") {
      startWizardConnect();
      return;
    }
    if (wizardHasNext) {
      setWizardWarning(null);
      setConnectWizardStep(Math.min(connectWizardSteps.length - 1, wizardStepIndex + 1));
      return;
    }
    startWizardConnect();
  };

  useEffect(() => {
    if ((status.state === "connectedKnown" || status.state === "connectedUnknown") && !wizardHidden) {
      updateWizardHidden(true);
    }
  }, [status.state, wizardHidden, updateWizardHidden]);

  useEffect(() => {
    if (!showConnectWizard) return;
    if (status.state === "connectedKnown" || status.state === "connectedUnknown") {
      setWizardWarning(null);
      requestConnectWizardClose();
    }
  }, [requestConnectWizardClose, showConnectWizard, status.state]);

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
            <button onClick={handleDisconnect} className="btn">Disconnect</button>
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
            onOpenLightingSettings={openGlobalLightingModal}
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

        {showWizardPrompt && (
          <div
            className={`modal-backdrop${wizardPromptClosing ? " closing" : ""}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (modalPointerDownRef.current) { modalPointerDownRef.current = false; return; }
              if (e.target === e.currentTarget) requestWizardPromptClose();
            }}
            onAnimationEnd={(e) => handleWizardPromptAnimationEnd(e.animationName)}
          >
            <div
              className={`modal config-modal${wizardPromptClosing ? " closing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={() => { modalPointerDownRef.current = true; }}
              onMouseUp={() => { modalPointerDownRef.current = false; }}
              onAnimationEnd={(e) => handleWizardPromptAnimationEnd(e.animationName)}
            >
              <div className="modal-header">
                <div className="modal-title">Connection unsuccessful</div>
              </div>
              <div className="modal-body">
                <p className="muted small">Would you like to open the connection wizard to troubleshoot the issue?</p>
              </div>
              <div className="modal-actions" style={{ justifyContent: "flex-end", gap: "8px" }}>
                <button className="btn" onClick={requestWizardPromptClose}>Cancel</button>
                <button className="btn btn-primary" onClick={() => { updateWizardHidden(false); openConnectWizard(); requestWizardPromptClose(); }}>Open wizard</button>
              </div>
            </div>
          </div>
        )}

        {showConnectWizard && activeWizardStep && (
          <div
            className={`modal-backdrop${connectWizardClosing ? " closing" : ""}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (modalPointerDownRef.current) { modalPointerDownRef.current = false; return; }
              if (status.state === "requesting") return;
              if (e.target === e.currentTarget) requestConnectWizardClose();
            }}
            onAnimationEnd={(e) => handleConnectWizardAnimationEnd(e.animationName)}
          >
            <div
              className={`modal config-modal setup-wizard-modal${wizardConnectStep ? " setup-wizard-modal-connect" : ""}${connectWizardClosing ? " closing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={() => { modalPointerDownRef.current = true; }}
              onMouseUp={() => { modalPointerDownRef.current = false; }}
              onAnimationEnd={(e) => handleConnectWizardAnimationEnd(e.animationName)}
            >
              <div className="modal-header" style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="modal-title">Connection wizard</div>
                </div>
              </div>

              {wizardWarning && (
                <div className="status-banner status-warn" style={{ margin: "10px 0 6px" }}>
                  <div className="status-title">Connection failed</div>
                  <div className="status-body">{wizardWarning}</div>
                </div>
              )}

              <div className="wizard-steps" aria-hidden="true">
                {connectWizardSteps.map((step, idx) => (
                  <button
                    key={step.id}
                    className={`wizard-step${idx === wizardStepIndex ? " wizard-step-active" : ""}`}
                    onClick={() => {
                      setWizardWarning(null);
                      setConnectWizardStep(idx);
                      if (step.id === "connect" && status.state !== "requesting") {
                        startWizardConnect();
                      }
                    }}
                    type="button"
                  >
                    <div className="wizard-step-index">{idx + 1}</div>
                    <div className="wizard-step-title">{step.title}</div>
                  </button>
                ))}
              </div>

              <div className="modal-body wizard-body">
                {renderWizardStepBody(activeWizardStep)}
              </div>

              <div className="wizard-footer">
                <div className="wizard-actions" style={{ width: "100%", justifyContent: "flex-end" }}>
                  <button className="btn" onClick={requestConnectWizardClose}>Cancel</button>
                  <button
                    className="btn"
                    disabled={!wizardHasPrev}
                    onClick={() => {
                      setWizardWarning(null);
                      setConnectWizardStep(Math.max(0, wizardStepIndex - 1));
                    }}
                  >Previous</button>
                  <button
                    className="btn btn-primary"
                    onClick={handleWizardPrimary}
                    disabled={status.state === "requesting"}
                  >{wizardPrimaryLabel}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {wizardShotPreview && (
          <div
            className={`modal-backdrop${wizardShotClosing ? " closing" : ""}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (modalPointerDownRef.current) { modalPointerDownRef.current = false; return; }
              if (e.target === e.currentTarget) requestWizardShotClose();
            }}
            onAnimationEnd={(e) => handleWizardShotAnimationEnd(e.animationName)}
          >
            <div
              className={`modal wizard-lightbox${wizardShotClosing ? " closing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={() => { modalPointerDownRef.current = true; }}
              onMouseUp={() => { modalPointerDownRef.current = false; }}
              onAnimationEnd={(e) => handleWizardShotAnimationEnd(e.animationName)}
            >
              <img src={wizardShotPreview.src} alt={wizardShotPreview.alt} />
              <div className="wizard-lightbox-footer">
                <div className="wizard-lightbox-title">{wizardShotPreview.title}</div>
                <div className="wizard-actions" style={{ justifyContent: "flex-end" }}>
                  <button className="btn" onClick={requestWizardShotClose}>Close</button>
                </div>
              </div>
            </div>
          </div>
        )}

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
                <button className="btn btn-primary" onClick={startDemo} disabled={!selectedDemoKey || demoOptions.length === 0}>Start demo</button>
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
              if (e.target === e.currentTarget) closeGlobalLightingModal();
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
                <button className="btn" onClick={closeGlobalLightingModal}>Cancel</button>
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
              if (e.target === e.currentTarget) closeLightingModal();
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
                  const maxIdx = draftLedConfig?.passiveColors.length ?? 0;
                  const clamped = maxIdx > 0 ? Math.min(Math.max(target, 0), maxIdx - 1) : 0;
                  const title = maxIdx > 0 ? `Edit ${ledDisplayName(clamped)} Lighting` : "Lighting";
                  return <div className="modal-title">{title}</div>;
                })()}
              </div>
              <div className="modal-body">
                {renderLightingBody()}
              </div>
              <div className="modal-actions">
                <button className="btn" onClick={closeLightingModal}>Cancel</button>
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
