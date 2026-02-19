/// <reference types="w3c-web-usb" />
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { type ConnectedInfo, type Progress } from "./lib/ch55xBootloader";
import {
  DEVICE_PROFILES,
  type BindingProfileDto,
  type DeviceLayoutDto,
  type HidBindingDto,
  type KnownDeviceProfile,
} from "./lib/keypadConfigs";
import { cloneLayout, loadLastDemoKey, saveLastDemoKey, saveStoredConfig } from "./lib/layoutStorage";
import { LayoutPreview } from "./components/LayoutPreview";
import { DEFAULT_BREATHING_MIN_PERCENT, DEFAULT_BREATHING_STEP_MS, DEFAULT_RAINBOW_STEP_MS } from "./components/lightingStyles";
import { StatusBanner } from "./components/StatusBanner";
import { StepEditor } from "./components/StepEditor";
import { ActionBar } from "./components/ActionBar";
import { DevToolsPanel } from "./components/DevToolsPanel";
import { ModalsHost } from "./components/ModalsHost";
import { useModalClosing } from "./hooks/useModalClosing";
import { useBootloaderConnection } from "./hooks/useBootloaderConnection";
import { useConfigPersistence } from "./hooks/useConfigPersistence";
import { useFirmwareFlashing, type DebugOptions as DebugOptionsDto } from "./hooks/useFirmwareFlashing";
import { useConfigImportExport } from "./hooks/useConfigImportExport";
import { useLightingState } from "./hooks/useLightingState";
import { useToast } from "./hooks/useToast";
import { useConnectionFlow } from "./hooks/useConnectionFlow";
import { useBindingsEditor } from "./hooks/useBindingsEditor";
import type { LedConfigurationDto, LedColor, Status, LedPerKeyDto } from "./types";
import "./styles/base.css";

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
  const [showDemoModal, setShowDemoModal] = useState<boolean>(false);
  const [lastDemoKey, setLastDemoKey] = useState<string | null>(() => loadLastDemoKey());
  const [selectedDemoKey, setSelectedDemoKey] = useState<string | null>(null);
  const [devMode, setDevMode] = useState<boolean>(false);
  const [debugFirmware, setDebugFirmware] = useState<boolean>(false);
  const defaultDebugOptions: DebugOptionsDto = { enableNoiseFilter: true, enablePullups: true, confirmSamples: 3, confirmDelayMs: 1 };
  const classicDebugOptions: DebugOptionsDto = { enableNoiseFilter: false, enablePullups: false, confirmSamples: 1, confirmDelayMs: 0 };
  const [debugOptions, setDebugOptions] = useState<DebugOptionsDto>(defaultDebugOptions);
  const { toast, showToast, clearToast } = useToast();
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

  const {
    showWizardPrompt,
    setShowWizardPrompt,
    showConnectWizard,
    setShowConnectWizard,
    connectSpinnerOpen,
    connectSpinnerClosing,
    handleConnectSpinnerAnimationEnd,
    handleConnectClick,
    handleWizardConnect,
    openConnectWizard,
    updateWizardHidden,
  } = useConnectionFlow({ status, performConnect });

  const {
    editorTarget,
    editorBinding,
    stepClipboard,
    setStepClipboard,
    openEdit,
    handleEditorSave,
    handleEditorClose,
    updateBootloaderOnBoot,
    updateBootloaderChordMember,
  } = useBindingsEditor({ currentBindings, setCurrentBindings, setSelectedLayout });

  const importTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const demoModalClosing = useModalClosing(showDemoModal, useCallback(() => setShowDemoModal(false), []));
  const globalLightingModalClosing = useModalClosing(showGlobalLightingModal, closeGlobalLightingModal);
  const lightingModalClosing = useModalClosing(showLightingModal, closeLightingModal);
  const { isClosing: demoModalClosingState, requestClose: requestDemoModalClose, handleAnimationEnd: handleDemoModalAnimationEnd } = demoModalClosing;
  const { isClosing: globalLightingClosing, requestClose: requestGlobalLightingClose, handleAnimationEnd: handleGlobalLightingAnimationEnd } = globalLightingModalClosing;
  const { isClosing: lightingClosing, requestClose: requestLightingClose, handleAnimationEnd: handleLightingAnimationEnd } = lightingModalClosing;

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
    clearToast();
  }, [clearToast]);

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

        <ActionBar
          demoMode={demoMode}
          connectedInfo={connectedInfo}
          devMode={devMode}
          hexDragOver={hexDragOver}
          clientRef={clientRef}
          handleConnectClick={handleConnectClick}
          handleDemoToggle={handleDemoToggle}
          handleDisconnect={handleDisconnect}
          handleHexClick={handleHexClick}
          handleHexDragOver={handleHexDragOver}
          handleHexDragLeave={handleHexDragLeave}
          handleHexDrop={handleHexDrop}
          fileInputRef={fileInputRef}
          onHexFileChange={onHexFileChange}
          compileAndFlash={compileAndFlash}
          selectedLayout={selectedLayout}
          debugFirmware={debugFirmware}
        />

        {devMode && (
          <DevToolsPanel
            debugFirmware={debugFirmware}
            setDebugFirmware={setDebugFirmware}
            debugOptions={debugOptions}
            setDebugOptions={setDebugOptions}
            classicDebugOptions={classicDebugOptions}
            defaultDebugOptions={defaultDebugOptions}
            connectedInfo={connectedInfo}
          />
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

        <ModalsHost
          showWizardPrompt={showWizardPrompt}
          setShowWizardPrompt={setShowWizardPrompt}
          updateWizardHidden={updateWizardHidden}
          openConnectWizard={openConnectWizard}
          showConnectWizard={showConnectWizard}
          setShowConnectWizard={setShowConnectWizard}
          status={status}
          isWindows={isWindows}
          handleWizardConnect={handleWizardConnect}
          connectSpinnerOpen={connectSpinnerOpen}
          connectSpinnerClosing={connectSpinnerClosing}
          handleConnectSpinnerAnimationEnd={handleConnectSpinnerAnimationEnd}
          showDemoModal={showDemoModal}
          demoModalClosingState={demoModalClosingState}
          demoOptions={demoOptions}
          selectedDemoKey={selectedDemoKey}
          setSelectedDemoKey={setSelectedDemoKey}
          handleStartDemo={handleStartDemo}
          requestDemoModalClose={requestDemoModalClose}
          handleDemoModalAnimationEnd={handleDemoModalAnimationEnd}
          showGlobalLightingModal={showGlobalLightingModal}
          globalLightingClosing={globalLightingClosing}
          draftLedConfig={draftLedConfig}
          setBrightnessPercent={setBrightnessPercent}
          saveGlobalLightingModal={saveGlobalLightingModal}
          requestGlobalLightingClose={requestGlobalLightingClose}
          handleGlobalLightingAnimationEnd={handleGlobalLightingAnimationEnd}
          showLightingModal={showLightingModal}
          selectedLayout={selectedLayout}
          layoutLedCount={layoutLedCount}
          focusLedIndex={focusLedIndex}
          lightingStatus={lightingStatus}
          copiedLedLighting={Boolean(copiedLedLighting)}
          lightingClosing={lightingClosing}
          requestLightingClose={requestLightingClose}
          handleLightingAnimationEnd={handleLightingAnimationEnd}
          saveLightingModal={saveLightingModal}
          setPassiveModeForLed={setPassiveModeForLed}
          setPassiveColor={setPassiveColor}
          setRainbowStepMs={setRainbowStepMs}
          setBreathingMinPercent={setBreathingMinPercent}
          setBreathingStepMs={setBreathingStepMs}
          setActiveMode={setActiveMode}
          setActiveColor={setActiveColor}
          copyLedLighting={copyLedLighting}
          pasteLedLighting={pasteLedLighting}
          applyLightingToAll={applyLightingToAll}
          ledDisplayName={ledDisplayName}
          showExportModal={showExportModal}
          exportModalClosingState={exportModalClosingState}
          exportText={exportText}
          exportCopyFlash={exportCopyFlash}
          exportCopyStatus={exportCopyStatus}
          handleExportCopy={handleExportCopy}
          requestExportModalClose={requestExportModalClose}
          handleExportModalAnimationEnd={handleExportModalAnimationEnd}
          showImportModal={showImportModal}
          importModalClosingState={importModalClosingState}
          importText={importText}
          importError={importError}
          importTextAreaRef={importTextAreaRef}
          setImportText={setImportText}
          setImportError={setImportError}
          applyImportedConfig={applyImportedConfig}
          requestImportModalClose={requestImportModalClose}
          handleImportModalAnimationEnd={handleImportModalAnimationEnd}
        />

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
