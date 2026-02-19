import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModalsHost } from "./ModalsHost";
import type { ModalsHostProps } from "./ModalsHost";
import { sampleLayout } from "../test/fixtures";

vi.mock("./ConnectWizardPrompt", () => ({
  ConnectWizardPrompt: (props: { isOpen: boolean; onConfirm: () => void; onCancel: () => void }) => (
    props.isOpen ? (
      <div>
        <button onClick={props.onConfirm}>prompt-confirm</button>
        <button onClick={props.onCancel}>prompt-cancel</button>
      </div>
    ) : null
  ),
}));

vi.mock("./ConnectWizard", () => ({
  ConnectWizard: (props: { isOpen: boolean }) => (props.isOpen ? <div>connect-wizard</div> : null),
}));

vi.mock("./ConnectSpinner", () => ({
  ConnectSpinner: () => <div>connect-spinner</div>,
}));

vi.mock("./modals/DemoDeviceModal", () => ({
  DemoDeviceModal: () => <div>demo-modal</div>,
}));

vi.mock("./modals/GlobalLightingModal", () => ({
  GlobalLightingModal: () => <div>global-lighting-modal</div>,
}));

vi.mock("./modals/KeyLightingModal", () => ({
  KeyLightingModal: () => <div>key-lighting-modal</div>,
}));

vi.mock("./modals/ExportConfigModal", () => ({
  ExportConfigModal: () => <div>export-modal</div>,
}));

vi.mock("./modals/ImportConfigModal", () => ({
  ImportConfigModal: (props: { onChangeText: (value: string) => void; onImport: () => void }) => (
    <div>
      <button onClick={() => props.onChangeText("new text")}>import-change</button>
      <button onClick={props.onImport}>import-run</button>
    </div>
  ),
}));

function buildProps(overrides: Partial<ModalsHostProps> = {}): ModalsHostProps {
  return {
    showWizardPrompt: false,
    setShowWizardPrompt: vi.fn(),
    updateWizardHidden: vi.fn(),
    openConnectWizard: vi.fn(),
    showConnectWizard: false,
    setShowConnectWizard: vi.fn(),
    status: { state: "idle" },
    isWindows: false,
    handleWizardConnect: vi.fn().mockResolvedValue(undefined),
    connectSpinnerOpen: false,
    connectSpinnerClosing: false,
    handleConnectSpinnerAnimationEnd: vi.fn(),
    showDemoModal: false,
    demoModalClosingState: false,
    demoOptions: [{ key: "demo-1", name: "Demo", bootloaderId: [1, 2, 3, 4] }],
    selectedDemoKey: "demo-1",
    setSelectedDemoKey: vi.fn(),
    handleStartDemo: vi.fn().mockResolvedValue(undefined),
    requestDemoModalClose: vi.fn(),
    handleDemoModalAnimationEnd: vi.fn(),
    showGlobalLightingModal: false,
    globalLightingClosing: false,
    draftLedConfig: null,
    setBrightnessPercent: vi.fn(),
    saveGlobalLightingModal: vi.fn(),
    requestGlobalLightingClose: vi.fn(),
    handleGlobalLightingAnimationEnd: vi.fn(),
    showLightingModal: false,
    selectedLayout: sampleLayout,
    layoutLedCount: 2,
    focusLedIndex: null,
    lightingStatus: "",
    copiedLedLighting: false,
    lightingClosing: false,
    requestLightingClose: vi.fn(),
    handleLightingAnimationEnd: vi.fn(),
    saveLightingModal: vi.fn(),
    setPassiveModeForLed: vi.fn(),
    setPassiveColor: vi.fn(),
    setRainbowStepMs: vi.fn(),
    setBreathingMinPercent: vi.fn(),
    setBreathingStepMs: vi.fn(),
    setActiveMode: vi.fn(),
    setActiveColor: vi.fn(),
    copyLedLighting: vi.fn(),
    pasteLedLighting: vi.fn(),
    applyLightingToAll: vi.fn(),
    ledDisplayName: (idx) => `LED ${idx}`,
    showExportModal: false,
    exportModalClosingState: false,
    exportText: "",
    exportCopyFlash: false,
    exportCopyStatus: "",
    handleExportCopy: vi.fn(),
    requestExportModalClose: vi.fn(),
    handleExportModalAnimationEnd: vi.fn(),
    showImportModal: false,
    importModalClosingState: false,
    importText: "payload",
    importError: "err",
    importTextAreaRef: { current: null },
    setImportText: vi.fn(),
    setImportError: vi.fn(),
    applyImportedConfig: vi.fn(),
    requestImportModalClose: vi.fn(),
    handleImportModalAnimationEnd: vi.fn(),
    ...overrides,
  };
}

describe("ModalsHost", () => {
  it("wires connect wizard prompt confirm to unhide and open wizard", () => {
    const updateWizardHidden = vi.fn();
    const openConnectWizard = vi.fn();

    render(<ModalsHost {...buildProps({ showWizardPrompt: true, updateWizardHidden, openConnectWizard })} />);

    fireEvent.click(screen.getByRole("button", { name: "prompt-confirm" }));

    expect(updateWizardHidden).toHaveBeenCalledWith(false);
    expect(openConnectWizard).toHaveBeenCalledTimes(1);
  });

  it("renders lighting modal only when open and layout exists", () => {
    const { rerender } = render(<ModalsHost {...buildProps({ showLightingModal: true, selectedLayout: null })} />);
    expect(screen.queryByText("key-lighting-modal")).toBeNull();

    rerender(<ModalsHost {...buildProps({ showLightingModal: true, selectedLayout: sampleLayout })} />);
    expect(screen.getByText("key-lighting-modal")).toBeTruthy();
  });

  it("resets import error on text change and imports current text", () => {
    const setImportText = vi.fn();
    const setImportError = vi.fn();
    const applyImportedConfig = vi.fn();

    render(<ModalsHost {...buildProps({ showImportModal: true, importText: "current payload", setImportText, setImportError, applyImportedConfig })} />);

    fireEvent.click(screen.getByRole("button", { name: "import-change" }));
    expect(setImportText).toHaveBeenCalledWith("new text");
    expect(setImportError).toHaveBeenCalledWith("");

    fireEvent.click(screen.getByRole("button", { name: "import-run" }));
    expect(applyImportedConfig).toHaveBeenCalledWith("current payload");
  });
});
