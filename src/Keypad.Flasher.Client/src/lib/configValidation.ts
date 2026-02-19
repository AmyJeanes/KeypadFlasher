import { normalizeIncomingStep } from "./bindingUtils";
import { cloneLayout } from "./layoutStorage";
import { DEFAULT_BREATHING_MIN_PERCENT, DEFAULT_BREATHING_STEP_MS, DEFAULT_RAINBOW_STEP_MS } from "../components/lightingStyles";
import type {
  BindingProfileDto,
  DeviceLayoutDto,
  HidBindingDto,
  HidStepDto,
  KnownDeviceProfile,
} from "./keypadConfigs";
import type { LedConfigurationDto, LedColor, PassiveLedMode, ActiveLedMode, LedPerKeyDto } from "../types";

const requireNumber = (value: unknown, label: string): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error(`${label} must be a number.`);
};

const requireBoolean = (value: unknown, label: string): boolean => {
  if (typeof value === "boolean") return value;
  throw new Error(`${label} must be a boolean.`);
};

const isSequenceBinding = (value: unknown): value is HidBindingDto => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HidBindingDto>;
  return candidate.type === "Sequence" && Array.isArray(candidate.steps);
};

const toSequenceBinding = (value: unknown, label: string): HidBindingDto => {
  if (!isSequenceBinding(value)) throw new Error(`${label} binding invalid.`);
  return { type: "Sequence", steps: value.steps.map((step) => normalizeIncomingStep(step as HidStepDto)) };
};

export const sameBootloaderId = (a: number[] | null, b: number[] | null): boolean => {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, idx) => v === b[idx]);
};

export const validateBootloaderConfigCandidate = (raw: unknown) => {
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

export const validateBindingProfileCandidate = (raw: unknown): BindingProfileDto => {
  if (!raw || typeof raw !== "object") throw new Error("Bindings must be an object.");
  const candidate = raw as { buttons?: unknown; encoders?: unknown };
  if (!Array.isArray(candidate.buttons)) throw new Error("Bindings must include buttons array.");
  if (!Array.isArray(candidate.encoders)) throw new Error("Bindings must include encoders array.");
  const buttons = candidate.buttons.map((b): BindingProfileDto["buttons"][number] => {
    if (!b || typeof b !== "object") throw new Error("Button binding invalid.");
    const { id, binding } = b as { id?: unknown; binding?: unknown };
    if (typeof id !== "number" || !Number.isFinite(id)) throw new Error("Button binding id missing.");
    const normalizedBinding = toSequenceBinding(binding, "Button");
    return { id, binding: normalizedBinding };
  });
  const encoders = candidate.encoders.map((e): BindingProfileDto["encoders"][number] => {
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

export const validateLedConfigCandidate = (raw: unknown): LedConfigurationDto => {
  if (!raw || typeof raw !== "object") throw new Error("LED config must be an object.");

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

  const parseLedObject = (value: unknown, idx: number): LedPerKeyDto => {
    if (!value || typeof value !== "object") throw new Error(`LED entry ${idx} must be an object.`);
    const candidate = value as {
      passiveMode?: unknown;
      passiveColor?: unknown;
      activeMode?: unknown;
      activeColor?: unknown;
      rainbowStepMs?: unknown;
      breathingMinPercent?: unknown;
      breathingStepMs?: unknown;
    };

    return {
      passiveMode: normalizePassiveMode(candidate.passiveMode),
      passiveColor: normColor(candidate.passiveColor),
      activeMode: normalizeActiveMode(candidate.activeMode),
      activeColor: normColor(candidate.activeColor),
      rainbowStepMs: requireNumber(candidate.rainbowStepMs ?? DEFAULT_RAINBOW_STEP_MS, "LED rainbowStepMs"),
      breathingMinPercent: requireNumber(candidate.breathingMinPercent ?? DEFAULT_BREATHING_MIN_PERCENT, "LED breathingMinPercent"),
      breathingStepMs: requireNumber(candidate.breathingStepMs ?? DEFAULT_BREATHING_STEP_MS, "LED breathingStepMs"),
    };
  };

  const rawConfig = raw as {
    leds?: unknown;
    brightnessPercent?: unknown;
  };

  const brightnessPercent = requireNumber(rawConfig.brightnessPercent ?? 100, "LED brightnessPercent");

  if (!Array.isArray(rawConfig.leds)) {
    throw new Error("LED config missing leds array.");
  }

  const leds = rawConfig.leds.map((entry, idx) => parseLedObject(entry, idx));
  return { leds, brightnessPercent };
};

export const bootloaderConfigFromLayout = (layout: DeviceLayoutDto) => ({
  buttons: layout.buttons.map((b) => ({ id: b.id, bootloaderOnBoot: b.bootloaderOnBoot, bootloaderChordMember: b.bootloaderChordMember })),
  encoders: layout.encoders.map((e) => ({ id: e.id, press: e.press ? { bootloaderOnBoot: e.press.bootloaderOnBoot, bootloaderChordMember: e.press.bootloaderChordMember } : undefined })),
});

export const applyBootloaderConfigToLayout = (layout: DeviceLayoutDto, config: ReturnType<typeof bootloaderConfigFromLayout>): DeviceLayoutDto => {
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

export const cloneProfileLayout = (profile: KnownDeviceProfile | null) => (profile?.layout ? cloneLayout(profile.layout) : null);
