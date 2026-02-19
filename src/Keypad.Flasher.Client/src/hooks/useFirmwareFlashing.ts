import { useCallback, useRef, useState, type ChangeEvent, type DragEvent, type MutableRefObject } from "react";
import { parseIntelHexBrowser, type BootloaderClient, type Progress } from "../lib/ch55xBootloader";
import type { BindingProfileDto, DeviceLayoutDto, KnownDeviceProfile } from "../lib/keypadConfigs";
import type { LedConfigurationDto, Status } from "../types";

export type DebugOptions = {
  enableNoiseFilter: boolean;
  enablePullups: boolean;
  confirmSamples: number;
  confirmDelayMs: number;
};

type FirmwareRequestBody = {
  layout: DeviceLayoutDto | null;
  bindingProfile: BindingProfileDto | null;
  debug: boolean;
  ledConfig: LedConfigurationDto | null;
  debugOptions: DebugOptions | null;
};

type UseFirmwareFlashingParams = {
  clientRef: MutableRefObject<BootloaderClient | null>;
  setStatus: (status: Status) => void;
  setProgress: (progress: Progress) => void;
  assertLedConfigMatchesLayout: (layout: DeviceLayoutDto | null, config: LedConfigurationDto | null) => LedConfigurationDto | null;
  selectedLayout: DeviceLayoutDto | null;
  selectedProfile: KnownDeviceProfile | null;
  currentBindings: BindingProfileDto | null;
  ledConfig: LedConfigurationDto | null;
  disconnectClient: () => Promise<void>;
  debugFirmware: boolean;
  debugOptions: DebugOptions;
};

type UseFirmwareFlashingResult = {
  hexDragOver: boolean;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  handleHexDragOver: (event: DragEvent) => void;
  handleHexDragLeave: (event: DragEvent) => void;
  handleHexDrop: (event: DragEvent) => Promise<void>;
  handleHexClick: () => void;
  onHexFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  compileAndFlash: () => Promise<void>;
};

export function useFirmwareFlashing(params: UseFirmwareFlashingParams): UseFirmwareFlashingResult {
  const {
    clientRef,
    setStatus,
    setProgress,
    assertLedConfigMatchesLayout,
    selectedLayout,
    selectedProfile,
    currentBindings,
    ledConfig,
    disconnectClient,
    debugFirmware,
    debugOptions,
  } = params;

  const [hexDragOver, setHexDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
  }, [clientRef, disconnectClient, setProgress, setStatus]);

  const processHexFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const { data } = parseIntelHexBrowser(text, 63 * 1024);
      await flashBytes(data);
    } catch (err) {
      setStatus({ state: "flashError", detail: String((err as Error).message ?? err) });
    }
  }, [flashBytes, setStatus]);

  const handleHexDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!hexDragOver) setHexDragOver(true);
  }, [hexDragOver]);

  const handleHexDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    if (hexDragOver) setHexDragOver(false);
  }, [hexDragOver]);

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
  }, [clientRef, processHexFile, setStatus]);

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
  }, [clientRef, setStatus]);

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
      const sanitizedDebugOptions: DebugOptions = {
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
        respBody = await resp.json().catch(() => null as unknown as typeof respBody);
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
  }, [assertLedConfigMatchesLayout, currentBindings, debugFirmware, debugOptions, flashBytes, ledConfig, selectedLayout, selectedProfile, setStatus]);

  return {
    hexDragOver,
    fileInputRef,
    handleHexDragOver,
    handleHexDragLeave,
    handleHexDrop,
    handleHexClick,
    onHexFileChange,
    compileAndFlash,
  };
}
