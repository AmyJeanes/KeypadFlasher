import type { BindingProfileDto, DeviceLayoutDto } from "./keypadConfigs";
import type { LedConfigurationDto } from "../types";

const STORAGE_PREFIX = "keypad-flasher";
const LAST_DEVICE_KEY = `${STORAGE_PREFIX}:last-device`;
const LAST_DEMO_KEY = `${STORAGE_PREFIX}:last-demo`;
const CONNECT_WIZARD_HIDDEN_KEY = `${STORAGE_PREFIX}:connect-wizard-hidden`;
const storageAvailable = typeof window !== "undefined" && !!window.localStorage;

export type StoredConfig = { bindings: BindingProfileDto | null; layout: DeviceLayoutDto | null; ledConfig: LedConfigurationDto | null };

export const cloneLayout = (layout: DeviceLayoutDto): DeviceLayoutDto => ({
  ...layout,
  buttons: layout.buttons.map((b) => ({ ...b })),
  encoders: layout.encoders.map((e) => ({ ...e, press: e.press ? { ...e.press } : undefined })),
});

export const loadStoredConfig = (bootloaderId: number[]): StoredConfig | null => {
  if (!storageAvailable) return null;
  const key = `${STORAGE_PREFIX}:${bootloaderId.join("-")}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConfig;
    if (parsed && typeof parsed === "object") {
      return {
        bindings: parsed.bindings ?? null,
        layout: parsed.layout ? cloneLayout(parsed.layout) : null,
        ledConfig: parsed.ledConfig ?? null,
      };
    }
  } catch {
    // clear corrupted entry so a fresh default can be used next time
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
  }
  return null;
};

export const saveStoredConfig = (bootloaderId: number[], config: StoredConfig) => {
  if (!storageAvailable) return;
  const key = `${STORAGE_PREFIX}:${bootloaderId.join("-")}`;
  try {
    if (config.bindings || config.layout || config.ledConfig) {
      window.localStorage.setItem(key, JSON.stringify(config));
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore storage errors
  }
};

export const clearStoredConfig = (bootloaderId: number[]) => {
  if (!storageAvailable) return;
  const key = `${STORAGE_PREFIX}:${bootloaderId.join("-")}`;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
};

export const loadLastBootloaderId = (): number[] | null => {
  if (!storageAvailable) return null;
  try {
    const raw = window.localStorage.getItem(LAST_DEVICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
      return parsed as number[];
    }
  } catch {
    // ignore parse/storage errors
  }
  return null;
};

export const saveLastBootloaderId = (bootloaderId: number[]) => {
  if (!storageAvailable) return;
  try {
    window.localStorage.setItem(LAST_DEVICE_KEY, JSON.stringify(bootloaderId));
  } catch {
    // ignore storage errors
  }
};

export const loadLastDemoKey = (): string | null => {
  if (!storageAvailable) return null;
  try {
    const raw = window.localStorage.getItem(LAST_DEMO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    // ignore parse/storage errors
  }
  return null;
};

export const saveLastDemoKey = (key: string) => {
  if (!storageAvailable) return;
  try {
    window.localStorage.setItem(LAST_DEMO_KEY, JSON.stringify(key));
  } catch {
    // ignore storage errors
  }
};

export const loadConnectWizardHidden = (): boolean => {
  if (!storageAvailable) return false;
  try {
    const raw = window.localStorage.getItem(CONNECT_WIZARD_HIDDEN_KEY);
    return raw === "true";
  } catch {
    // ignore storage errors
  }
  return false;
};

export const saveConnectWizardHidden = (hidden: boolean) => {
  if (!storageAvailable) return;
  try {
    window.localStorage.setItem(CONNECT_WIZARD_HIDDEN_KEY, hidden ? "true" : "false");
  } catch {
    // ignore storage errors
  }
};
