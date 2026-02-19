import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import {
  CH55xBootloader,
  FakeBootloader,
  normalizeUsbErrorMessage,
  type BootloaderClient,
  type ConnectedInfo,
} from "../lib/ch55xBootloader";
import type { Status } from "../types";

export type DemoOption = { key: string; name: string; bootloaderId: number[] };

export type UseBootloaderConnectionParams = {
  status: Status;
  setStatus: (status: Status) => void;
  applyConnectedDevice: (info: ConnectedInfo, options: { source: "real" | "demo"; persistLastId: boolean }) => void;
  restoreSavedConfig: () => void;
  connectedInfo: ConnectedInfo | null;
  setConnectedInfo: (info: ConnectedInfo | null) => void;
  demoMode: boolean;
  setDemoMode: (value: boolean) => void;
  onDisconnected?: () => void;
};

export type UseBootloaderConnectionResult = {
  clientRef: MutableRefObject<BootloaderClient | null>;
  webUsbAvailable: boolean;
  secure: boolean;
  isWindows: boolean;
  performConnect: (options?: { origin?: "wizard" | "direct"; wizardHidden?: boolean; onShowWizardPrompt?: () => void; onRequesting?: () => void; }) => Promise<void>;
  handleDisconnect: (reboot?: boolean, nextStatus?: Status) => Promise<void>;
  handlePassiveDisconnect: (detail?: string) => Promise<void>;
  startDemo: (params: { selectedDemoKey: string | null; demoOptions: DemoOption[]; rememberDemoKey: (key: string) => void; onBeforeStart?: () => void; }) => Promise<void>;
};

export function useBootloaderConnection(params: UseBootloaderConnectionParams): UseBootloaderConnectionResult {
  const { status, setStatus, applyConnectedDevice, restoreSavedConfig, connectedInfo, setConnectedInfo, demoMode, setDemoMode, onDisconnected } = params;
  const clientRef = useRef<BootloaderClient | null>(null);

  const webUsbAvailable = useMemo(() => CH55xBootloader.isWebUsbAvailable(), []);
  const secure = typeof window !== "undefined" ? window.isSecureContext : true;
  const isWindows = typeof navigator !== "undefined" && /windows/i.test(navigator.userAgent);

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
    if (onDisconnected) onDisconnected();
    restoreSavedConfig();
    if (nextStatus) setStatus(nextStatus);
  }, [onDisconnected, restoreSavedConfig, setConnectedInfo, setDemoMode, setStatus]);

  const handlePassiveDisconnect = useCallback(async (detail?: string) => {
    await disconnectClient({ state: "deviceLost", detail: detail ?? "Device disconnected. Reconnect to continue." });
  }, [disconnectClient]);

  const performConnect = useCallback(async (options?: { origin?: "wizard" | "direct"; wizardHidden?: boolean; onShowWizardPrompt?: () => void; onRequesting?: () => void; }) => {
    const origin = options?.origin ?? "direct";
    if (!webUsbAvailable) {
      setStatus({ state: "error", detail: "WebUSB not available in this browser." });
      return;
    }
    try {
      if (options?.onRequesting) options.onRequesting();
      setStatus({ state: "requesting" });
      if (demoMode && clientRef.current) {
        await clientRef.current.disconnect().catch(() => {});
      }

      const existing = clientRef.current;
      const client = existing instanceof CH55xBootloader ? existing : new CH55xBootloader();
      clientRef.current = client;

      setDemoMode(false);
      const info = await client.connect();
      setConnectedInfo(info);
      applyConnectedDevice(info, { source: "real", persistLastId: true });
    } catch (e) {
      const msg = normalizeUsbErrorMessage(String((e as Error).message ?? e));
      if (origin === "wizard") {
        setStatus({ state: "error", detail: msg });
        throw new Error(msg);
      }
      if (options?.wizardHidden && msg.startsWith("No device selected")) {
        if (options?.onShowWizardPrompt) options.onShowWizardPrompt();
        setStatus({ state: "idle" });
        return;
      }
      setStatus({ state: "error", detail: msg });
    }
  }, [applyConnectedDevice, demoMode, setStatus, webUsbAvailable]);

  const handleDisconnect = useCallback(async (reboot?: boolean, nextStatus?: Status) => {
    await disconnectClient(nextStatus ?? { state: "idle" }, reboot);
  }, [disconnectClient]);

  const startDemo = useCallback(async (params: { selectedDemoKey: string | null; demoOptions: DemoOption[]; rememberDemoKey: (key: string) => void; onBeforeStart?: () => void; }) => {
    const { selectedDemoKey, demoOptions, rememberDemoKey, onBeforeStart } = params;
    const chosen = demoOptions.find((opt) => opt.key === selectedDemoKey) ?? demoOptions[0];
    if (!chosen) {
      setStatus({ state: "error", detail: "No demo devices available." });
      return;
    }

    try {
      if (onBeforeStart) onBeforeStart();
      setStatus({ state: "requesting", detail: "Starting demo…" });
      if (clientRef.current) {
        await clientRef.current.disconnect().catch(() => {});
      }
      const client = new FakeBootloader({ bootloaderId: chosen.bootloaderId });
      clientRef.current = client;
      const info = await client.connect();
      setDemoMode(true);
      rememberDemoKey(chosen.key);
      setConnectedInfo(info);
      applyConnectedDevice(info, { source: "demo", persistLastId: false });
    } catch (err) {
      clientRef.current = null;
      setDemoMode(false);
      setStatus({ state: "error", detail: String((err as Error).message ?? "Failed to start demo mode.") });
    }
  }, [applyConnectedDevice, setStatus]);

  useEffect(() => {
    if (!webUsbAvailable || typeof navigator === "undefined" || !navigator.usb) return undefined;
    const onUsbDisconnect = (event: USBConnectionEvent) => {
      const connected = clientRef.current?.getConnectedDevice?.();
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
    if (demoMode) return undefined;
    if (!connectedInfo || !clientRef.current) return undefined;
    if (status.state === "flashing" || status.state === "compiling" || status.state === "requesting") return undefined;
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

  return {
    clientRef,
    webUsbAvailable,
    secure,
    isWindows,
    performConnect,
    handleDisconnect,
    handlePassiveDisconnect,
    startDemo,
  };
}
