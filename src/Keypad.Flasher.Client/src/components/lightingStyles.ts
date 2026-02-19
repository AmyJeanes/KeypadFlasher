import type { CSSProperties } from "react";
import type { LedColor, PassiveLedMode } from "../types";

export const DEFAULT_RAINBOW_STEP_MS = 20;
export const DEFAULT_BREATHING_STEP_MS = 20;
export const DEFAULT_BREATHING_MIN_PERCENT = 20;
export const MAX_BREATHING_MIN_PERCENT = 80;

// Global knobs for preview intensity when muted vs. unmuted.
const BASE_RAINBOW_ALPHA = 1;
const BASE_PRIMARY_ALPHA = 0.9;
const BASE_SECONDARY_ALPHA = 0.7;
const BASE_BORDER_ALPHA = 0.9;
const MUTED_ALPHA_SCALE = 0.7; // raise/lower to change how muted previews look

type PassiveLightingStyleInput = {
  passiveMode: PassiveLedMode;
  passiveColor: LedColor;
  rainbowStepMs?: number | number[];
  breathingMinPercent?: number | number[];
  breathingStepMs?: number | number[];
  ledIndex?: number;
  muted?: boolean;
};

type RainbowStyle = CSSProperties & {
  "--rainbow-duration"?: string;
  "--rainbow-delay"?: string;
  "--rainbow-alpha"?: string;
};

type BreathingStyle = CSSProperties & {
  "--breathing-duration"?: string;
  "--breathing-min"?: string;
};

export const getPassiveLightingStyle = (input: PassiveLightingStyleInput): { className?: string; style?: CSSProperties } => {
  const {
    passiveMode,
    passiveColor,
    rainbowStepMs,
    breathingMinPercent,
    breathingStepMs,
    ledIndex = 0,
    muted = true,
  } = input;

  const resolvePerLed = (value: number | number[] | undefined, fallback: number): number => {
    if (Array.isArray(value)) {
      const idx = Math.max(0, Math.min(value.length - 1, ledIndex));
      return value[idx] ?? fallback;
    }
    if (typeof value === "number") {
      return value;
    }
    return fallback;
  };

  if (passiveMode === "Rainbow") {
    const step = resolvePerLed(rainbowStepMs, DEFAULT_RAINBOW_STEP_MS);
    const durationSec = Math.max(0.2, (192 * step) / 1000); // firmware: 192 hue steps, one per step_ms
    const hueOffsetSteps = (ledIndex * 8) % 192; // firmware: per-LED hue offset = led * 8 (mod 192)
    const delaySec = -(hueOffsetSteps * step) / 1000; // align phase offset in time
    const rainbowAlpha = (muted ? MUTED_ALPHA_SCALE : 1) * BASE_RAINBOW_ALPHA;
    const rainbowStyle: RainbowStyle = {
      "--rainbow-duration": `${durationSec}s`,
      "--rainbow-delay": `${delaySec}s`,
      "--rainbow-alpha": `${rainbowAlpha}`,
    };
    return { className: "rainbow", style: rainbowStyle };
  }

  if (passiveMode === "Static" || passiveMode === "Breathing") {
    const color = passiveColor;
    const minPercentRaw = resolvePerLed(breathingMinPercent, DEFAULT_BREATHING_MIN_PERCENT);
    const minPercent = Math.min(MAX_BREATHING_MIN_PERCENT, minPercentRaw);
    const step = resolvePerLed(breathingStepMs, DEFAULT_BREATHING_STEP_MS);
    const durationSec = Math.max(0.2, ((100 - minPercent) * 2 * step) / 1000); // firmware: +/-1% per step_ms
    const alphaScale = muted ? MUTED_ALPHA_SCALE : 1;
    const primaryAlpha = BASE_PRIMARY_ALPHA * alphaScale;
    const secondaryAlpha = BASE_SECONDARY_ALPHA * alphaScale;
    const borderAlpha = BASE_BORDER_ALPHA * alphaScale;
    const breathingStyle: BreathingStyle | undefined = passiveMode === "Breathing"
      ? {
        "--breathing-duration": `${durationSec}s`,
        "--breathing-min": `${Math.max(0.05, Math.min(0.95, minPercent / 100))}`,
      }
      : undefined;
    const breathingClass = passiveMode === "Breathing" ? "breathing" : undefined;

    return {
      ...(breathingClass ? { className: breathingClass } : {}),
      style: {
        background: "var(--card-bg)",
        backgroundImage: `linear-gradient(135deg, rgba(${color.r}, ${color.g}, ${color.b}, ${primaryAlpha}), rgba(${color.r}, ${color.g}, ${color.b}, ${secondaryAlpha}))`,
        boxShadow: "var(--shadow-strong)",
        borderColor: `rgba(${color.r}, ${color.g}, ${color.b}, ${borderAlpha})`,
        ...(breathingStyle ?? {}),
      },
    };
  }

  return {};
};