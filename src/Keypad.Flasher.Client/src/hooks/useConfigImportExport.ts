import { useCallback, useMemo, useState, type MutableRefObject } from "react";
import { applyBootloaderConfigToLayout, bootloaderConfigFromLayout, sameBootloaderId, validateBindingProfileCandidate, validateBootloaderConfigCandidate, validateLedConfigCandidate } from "../lib/configValidation";
import { cloneLayout, saveStoredConfig } from "../lib/layout-storage";
import type { ConnectedInfo } from "../lib/ch55x-bootloader";
import type { BindingProfileDto, DeviceLayoutDto } from "../lib/keypad-configs";
import type { LedConfigurationDto, Status } from "../types";

type UseConfigImportExportParams = {
  currentBindings: BindingProfileDto | null;
  selectedLayout: DeviceLayoutDto | null;
  ledConfig: LedConfigurationDto | null;
  selectedProfileName: string | null;
  connectedInfo: ConnectedInfo | null;
  rememberedBootloaderId: number[] | null;
  lastBootloaderIdRef: MutableRefObject<number[] | null>;
  assertLedConfigMatchesLayout: (layout: DeviceLayoutDto | null, config: LedConfigurationDto | null) => LedConfigurationDto | null;
  setSelectedLayout: (layout: DeviceLayoutDto | null) => void;
  setCurrentBindings: (bindings: BindingProfileDto | null) => void;
  setLedConfig: (config: LedConfigurationDto | null) => void;
  showToast: (message: string, tone?: "info" | "success" | "warn" | "error", durationMs?: number) => void;
  setStatus: (status: Status) => void;
};

type UseConfigImportExportApi = {
  showExportModal: boolean;
  setShowExportModal: (open: boolean) => void;
  showImportModal: boolean;
  setShowImportModal: (open: boolean) => void;
  exportText: string;
  exportCopyStatus: string;
  exportCopyFlash: boolean;
  importText: string;
  importError: string;
  setImportText: (text: string) => void;
  setImportError: (text: string) => void;
  openExportModal: () => void;
  handleExportCopy: () => Promise<void>;
  openImportModal: () => void;
  applyImportedConfig: (text: string) => void;
};

export function useConfigImportExport(params: UseConfigImportExportParams): UseConfigImportExportApi {
  const {
    currentBindings,
    selectedLayout,
    ledConfig,
    selectedProfileName,
    connectedInfo,
    rememberedBootloaderId,
    lastBootloaderIdRef,
    assertLedConfigMatchesLayout,
    setSelectedLayout,
    setCurrentBindings,
    setLedConfig,
    showToast,
    setStatus,
  } = params;

  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [exportText, setExportText] = useState<string>("");
  const [exportCopyStatus, setExportCopyStatus] = useState<string>("");
  const [exportCopyFlash, setExportCopyFlash] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>("");
  const [importError, setImportError] = useState<string>("");

  const targetDeviceId = useMemo(() => connectedInfo?.id ?? rememberedBootloaderId ?? lastBootloaderIdRef.current ?? null, [connectedInfo?.id, rememberedBootloaderId, lastBootloaderIdRef]);

  const openExportModal = useCallback(() => {
    if (!currentBindings) {
      setStatus({ state: "error", detail: "Nothing to export yet. Connect a device and load bindings first." });
      return;
    }
    if (!selectedLayout) {
      setStatus({ state: "error", detail: "Layout not ready yet. Connect a device before exporting." });
      return;
    }
    if (!targetDeviceId) {
      setStatus({ state: "error", detail: "Connect a device before exporting." });
      return;
    }
    try {
      const payload = {
        version: 1,
        deviceId: targetDeviceId,
        profile: selectedProfileName,
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
  }, [assertLedConfigMatchesLayout, currentBindings, ledConfig, selectedLayout, selectedProfileName, setStatus, targetDeviceId]);

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
    const targetId = targetDeviceId;
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
  }, [assertLedConfigMatchesLayout, selectedLayout, targetDeviceId]);

  const applyImportedConfig = useCallback((text: string) => {
    try {
      const next = parseImportedConfig(text);
      setSelectedLayout(next.layout);
      setCurrentBindings(next.bindings);
      setLedConfig(next.ledConfig);
      if (targetDeviceId) {
        saveStoredConfig(targetDeviceId, { bindings: next.bindings, layout: next.layout, ledConfig: next.ledConfig });
      }
      setShowImportModal(false);
      setImportError("");
      showToast("Configuration imported", "success", 20000);
    } catch (err) {
      setImportError(String((err as Error).message ?? err));
    }
  }, [parseImportedConfig, setCurrentBindings, setLedConfig, setSelectedLayout, showToast, targetDeviceId]);

  return useMemo(() => ({
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
  }), [
    applyImportedConfig,
    exportCopyFlash,
    exportCopyStatus,
    exportText,
    handleExportCopy,
    importError,
    importText,
    openExportModal,
    openImportModal,
    setImportError,
    setImportText,
    showExportModal,
    showImportModal,
  ]);
}
