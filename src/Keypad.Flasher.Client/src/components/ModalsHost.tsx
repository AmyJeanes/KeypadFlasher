import { type RefObject } from "react";
import { ConnectWizardPrompt } from "./ConnectWizardPrompt";
import { ConnectWizard } from "./ConnectWizard";
import { ConnectSpinner } from "./ConnectSpinner";
import { DemoDeviceModal } from "./modals/DemoDeviceModal";
import { GlobalLightingModal } from "./modals/GlobalLightingModal";
import { KeyLightingModal } from "./modals/KeyLightingModal";
import { ExportConfigModal } from "./modals/ExportConfigModal";
import { ImportConfigModal } from "./modals/ImportConfigModal";
import type { Status, LedConfigurationDto, LedColor, ActiveLedMode, PassiveLedMode } from "../types";
import type { DemoOption } from "../hooks/useBootloaderConnection";
import type { DeviceLayoutDto } from "../lib/keypadConfigs";

export type ModalsHostProps = {
  // Wizard / connection
  showWizardPrompt: boolean;
  setShowWizardPrompt: (value: boolean) => void;
  updateWizardHidden: (hidden: boolean) => void;
  openConnectWizard: () => void;
  showConnectWizard: boolean;
  setShowConnectWizard: (value: boolean) => void;
  status: Status;
  isWindows: boolean;
  handleWizardConnect: () => Promise<void>;
  connectSpinnerOpen: boolean;
  connectSpinnerClosing: boolean;
  handleConnectSpinnerAnimationEnd: (animationName: string) => void;

  // Demo selection
  showDemoModal: boolean;
  demoModalClosingState: boolean;
  demoOptions: DemoOption[];
  selectedDemoKey: string | null;
  setSelectedDemoKey: (key: string | null) => void;
  handleStartDemo: () => Promise<void>;
  requestDemoModalClose: () => void;
  handleDemoModalAnimationEnd: (animationName: string) => void;

  // Lighting
  showGlobalLightingModal: boolean;
  globalLightingClosing: boolean;
  draftLedConfig: LedConfigurationDto | null;
  setBrightnessPercent: (value: number) => void;
  saveGlobalLightingModal: () => void;
  requestGlobalLightingClose: () => void;
  handleGlobalLightingAnimationEnd: (animationName: string) => void;

  showLightingModal: boolean;
  selectedLayout: DeviceLayoutDto | null;
  layoutLedCount: number;
  focusLedIndex: number | null;
  lightingStatus: string;
  copiedLedLighting: boolean;
  lightingClosing: boolean;
  requestLightingClose: () => void;
  handleLightingAnimationEnd: (animationName: string) => void;
  saveLightingModal: () => void;
  setPassiveModeForLed: (idx: number, mode: PassiveLedMode) => void;
  setPassiveColor: (idx: number, color: LedColor) => void;
  setRainbowStepMs: (idx: number, value: number) => void;
  setBreathingMinPercent: (idx: number, value: number) => void;
  setBreathingStepMs: (idx: number, value: number) => void;
  setActiveMode: (idx: number, mode: ActiveLedMode) => void;
  setActiveColor: (idx: number, color: LedColor) => void;
  copyLedLighting: (idx: number, displayName: string) => void;
  pasteLedLighting: (idx: number, displayName: string) => void;
  applyLightingToAll: (idx: number, displayName: string) => void;
  ledDisplayName: (idx: number) => string;

  // Export / import
  showExportModal: boolean;
  exportModalClosingState: boolean;
  exportText: string;
  exportCopyFlash: boolean;
  exportCopyStatus: string;
  handleExportCopy: () => void;
  requestExportModalClose: () => void;
  handleExportModalAnimationEnd: (animationName: string) => void;

  showImportModal: boolean;
  importModalClosingState: boolean;
  importText: string;
  importError: string;
  importTextAreaRef: RefObject<HTMLTextAreaElement | null>;
  setImportText: (value: string) => void;
  setImportError: (value: string) => void;
  applyImportedConfig: (value: string) => void;
  requestImportModalClose: () => void;
  handleImportModalAnimationEnd: (animationName: string) => void;
};

export function ModalsHost(props: ModalsHostProps) {
  const {
    showWizardPrompt,
    setShowWizardPrompt,
    updateWizardHidden,
    openConnectWizard,
    showConnectWizard,
    setShowConnectWizard,
    status,
    isWindows,
    handleWizardConnect,
    connectSpinnerOpen,
    connectSpinnerClosing,
    handleConnectSpinnerAnimationEnd,
    showDemoModal,
    demoModalClosingState,
    demoOptions,
    selectedDemoKey,
    setSelectedDemoKey,
    handleStartDemo,
    requestDemoModalClose,
    handleDemoModalAnimationEnd,
    showGlobalLightingModal,
    globalLightingClosing,
    draftLedConfig,
    setBrightnessPercent,
    saveGlobalLightingModal,
    requestGlobalLightingClose,
    handleGlobalLightingAnimationEnd,
    showLightingModal,
    selectedLayout,
    layoutLedCount,
    focusLedIndex,
    lightingStatus,
    copiedLedLighting,
    lightingClosing,
    requestLightingClose,
    handleLightingAnimationEnd,
    saveLightingModal,
    setPassiveModeForLed,
    setPassiveColor,
    setRainbowStepMs,
    setBreathingMinPercent,
    setBreathingStepMs,
    setActiveMode,
    setActiveColor,
    copyLedLighting,
    pasteLedLighting,
    applyLightingToAll,
    ledDisplayName,
    showExportModal,
    exportModalClosingState,
    exportText,
    exportCopyFlash,
    exportCopyStatus,
    handleExportCopy,
    requestExportModalClose,
    handleExportModalAnimationEnd,
    showImportModal,
    importModalClosingState,
    importText,
    importError,
    importTextAreaRef,
    setImportText,
    setImportError,
    applyImportedConfig,
    requestImportModalClose,
    handleImportModalAnimationEnd,
  } = props;

  return (
    <>
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
        <DemoDeviceModal
          closing={demoModalClosingState}
          options={demoOptions}
          selectedKey={selectedDemoKey}
          onSelectKey={setSelectedDemoKey}
          onStart={handleStartDemo}
          onRequestClose={requestDemoModalClose}
          onAnimationEnd={handleDemoModalAnimationEnd}
        />
      )}

      {showGlobalLightingModal && (
        <GlobalLightingModal
          closing={globalLightingClosing}
          draftLedConfig={draftLedConfig}
          onChangeBrightness={setBrightnessPercent}
          onSave={saveGlobalLightingModal}
          onRequestClose={requestGlobalLightingClose}
          onAnimationEnd={handleGlobalLightingAnimationEnd}
        />
      )}

      {showLightingModal && selectedLayout && (
        <KeyLightingModal
          closing={lightingClosing}
          draftLedConfig={draftLedConfig}
          layoutLedCount={layoutLedCount}
          focusLedIndex={focusLedIndex}
          lightingStatus={lightingStatus}
          copiedLedLighting={Boolean(copiedLedLighting)}
          onRequestClose={requestLightingClose}
          onAnimationEnd={handleLightingAnimationEnd}
          onSave={saveLightingModal}
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
        />
      )}

      {showExportModal && (
        <ExportConfigModal
          closing={exportModalClosingState}
          exportText={exportText}
          exportCopyFlash={exportCopyFlash}
          exportCopyStatus={exportCopyStatus}
          onCopy={handleExportCopy}
          onRequestClose={requestExportModalClose}
          onAnimationEnd={handleExportModalAnimationEnd}
        />
      )}

      {showImportModal && (
        <ImportConfigModal
          closing={importModalClosingState}
          importText={importText}
          importError={importError}
          textAreaRef={importTextAreaRef}
          onChangeText={(value) => { setImportText(value); setImportError(""); }}
          onImport={() => applyImportedConfig(importText)}
          onRequestClose={requestImportModalClose}
          onAnimationEnd={handleImportModalAnimationEnd}
        />
      )}
    </>
  );
}
