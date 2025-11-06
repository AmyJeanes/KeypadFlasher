/// <reference types="w3c-web-usb" />
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  CH55xBootloader,
  parseIntelHexBrowser,
  type ConnectedInfo,
  type Progress,
  readFileAsText,
  normalizeUsbErrorMessage,
} from "./lib/ch55x-bootloader";
import './ch55xbl.css';

export default function CH55xBootloaderMinimal() {
  const [status, setStatus] = useState<string>("Idle");
  const [connectedInfo, setConnectedInfo] = useState<ConnectedInfo | null>(null);
  const [progress, setProgress] = useState<Progress>({ phase: "", current: 0, total: 0 });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const clientRef = useRef<CH55xBootloader | null>(null);

  const webUsbAvailable = CH55xBootloader.isWebUsbAvailable();
  const secure = typeof window !== "undefined" ? window.isSecureContext : true;

  useEffect(() => {
    return () => { clientRef.current?.disconnect().catch(() => {}); };
  }, []);

  const handleConnect = useCallback(async () => {
    if (!webUsbAvailable) { setStatus("WebUSB not available in this browser."); return; }
    try {
      setStatus("Requesting device…");
      const client = clientRef.current ?? new CH55xBootloader();
      clientRef.current = client;
      const info = await client.connect();
      setConnectedInfo(info);
      setStatus(`Bootloader ${info.version}, ID: ${info.id.join(", ")}`);
    } catch (e) {
      const msg = normalizeUsbErrorMessage(String((e as Error).message ?? e));
      setStatus(msg);
    }
  }, [webUsbAvailable]);

  const flashBytes = useCallback(async (bytes: Uint8Array) => {
    const client = clientRef.current;
    if (!client) { setStatus("Connect bootloader first."); return; }

    try {
      setStatus("Flashing…");
      await client.flashBinary(bytes, (p) => setProgress(p));
      setStatus("Flash finished ✔");
    } catch (e) {
      setStatus(String((e as Error).message ?? e));
    } finally {
      setProgress({ phase: "", current: 0, total: 0 });
    }
  }, []);

  const handlePickFile = useCallback(() => {
    if (!clientRef.current) { setStatus("Connect bootloader first."); return; }
    if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
      setStatus("The File APIs are not fully supported in this browser.");
      return;
    }
    fileInputRef.current?.click();
  }, []);

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const { data } = parseIntelHexBrowser(text, 63 * 1024);
      await flashBytes(data);
    } catch (err) {
      setStatus(String((err as Error).message ?? err));
    } finally {
      e.target.value = ""; // allow re-pick of same file
    }
  }, [flashBytes]);

  const compileAndFlash = useCallback(async () => {
    try {
      setStatus("Compiling…");
      const resp = await fetch("flasher");
      if (!resp.ok) throw new Error(`Compile failed: ${resp.status} ${resp.statusText}`);
      const json = await resp.json();
      const base64 = json.fileBytes;
      const text = atob(base64);
      const { data } = parseIntelHexBrowser(text, 63 * 1024);
      await flashBytes(data);
    } catch (err) {
      setStatus(String((err as Error).message ?? err));
    }
  }, [flashBytes]);

  const connectedLabel = useMemo(() => {
    if (!connectedInfo) return "Not connected";
    return `Connected: Bootloader ${connectedInfo.version}, ID ${connectedInfo.id.join(", ")}, Device ${connectedInfo.deviceIdHex}`;
  }, [connectedInfo]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">CH55x Bootloader Uploader</h1>
          <p className="text-sm text-neutral-600">
            WebUSB + React. Works in Chromium browsers over HTTPS. Click Connect first, then Upload a .hex file.
          </p>
        </header>

        <div className="flex flex-wrap gap-3">
          <button onClick={handleConnect} className="px-4 py-2 rounded-2xl shadow bg-white hover:shadow-md border border-neutral-200">
            Connect
          </button>
          <button
            onClick={handlePickFile}
            className="px-4 py-2 rounded-2xl shadow bg-white hover:shadow-md border border-neutral-200 disabled:opacity-50"
            disabled={!clientRef.current}
          >
            Upload .hex
          </button>
          <input ref={fileInputRef} type="file" accept=".hex,.ihx,.ihex,.txt" className="hidden" onChange={onFileChange} />
          <button onClick={compileAndFlash} className="px-4 py-2 rounded-2xl shadow bg-white hover:shadow-md border border-neutral-200">
            Compile & Flash
          </button>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-neutral-700"><strong>Status:</strong> {status}</div>
          <div className="text-xs text-neutral-600">{connectedLabel}</div>
          {progress.total > 0 && (
            <div className="w-full bg-neutral-200 rounded-xl h-2 mt-2">
              <div className="bg-neutral-800 h-2 rounded-xl" style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }} />
              <div className="text-xs text-neutral-600 mt-1">
                {progress.phase} {progress.current} / {progress.total}
              </div>
            </div>
          )}
        </div>

        {!webUsbAvailable && (
          <div className="p-3 rounded-xl bg-yellow-100 text-yellow-900 border border-yellow-300">
            Your browser does not support WebUSB. Try Chromium-based browsers over HTTPS.
          </div>
        )}
        {webUsbAvailable && !secure && (
          <div className="p-3 rounded-xl bg-yellow-100 text-yellow-900 border border-yellow-300">
            This page is not a secure context. WebUSB usually requires HTTPS.
          </div>
        )}
      </div>
    </div>
  );
}
