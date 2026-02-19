import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { LedColor, PassiveLedMode, ActiveLedMode } from "../types";
import { getPassiveLightingStyle } from "./lightingStyles";

const labelForMode = (mode: PassiveLedMode): string => {
  switch (mode) {
    case "Rainbow": return "Rainbow";
    case "Breathing": return "Breathing";
    case "Static": return "Static";
    case "Off":
    default:
      return "Off";
  }
};

type InputLightingPreviewProps = {
  passiveMode: PassiveLedMode;
  passiveColor: LedColor;
  activeMode?: ActiveLedMode;
  activeColor?: LedColor;
  rainbowStepMs?: number | number[];
  breathingMinPercent?: number | number[];
  breathingStepMs?: number | number[];
  ledIndex?: number;
  size?: "sm" | "md";
  interactive?: boolean;
  muted?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function InputLightingPreview({ passiveMode, passiveColor, activeMode = "Solid", activeColor, rainbowStepMs, breathingMinPercent, breathingStepMs, ledIndex = 0, size = "md", interactive = false, muted = true, className = "", style }: InputLightingPreviewProps) {
  const [showActive, setShowActive] = useState(false);
  const dim = size === "sm" ? 64 : 80;

  const hasActiveStyle = activeMode === "Solid" && Boolean(activeColor);

  useEffect(() => {
    if (!interactive || activeMode === "Off" || !hasActiveStyle) {
      setShowActive(false);
    }
  }, [interactive, activeMode, hasActiveStyle]);

  const passiveStyle = useMemo(() => getPassiveLightingStyle({
    passiveMode,
    passiveColor,
    rainbowStepMs,
    breathingMinPercent,
    breathingStepMs,
    ledIndex,
    muted,
  }), [passiveMode, passiveColor, rainbowStepMs, breathingMinPercent, breathingStepMs, ledIndex, muted]);

  const activeStyle = useMemo(() => {
    if (!hasActiveStyle || !activeColor) return {} as const;
    return {
      className: "active",
      style: {
        background: "var(--card-bg)",
        backgroundImage: `linear-gradient(145deg, rgba(${activeColor.r}, ${activeColor.g}, ${activeColor.b}, 0.9), rgba(${activeColor.r}, ${activeColor.g}, ${activeColor.b}, 0.65))`,
        borderColor: `rgba(${activeColor.r}, ${activeColor.g}, ${activeColor.b}, 0.7)`
      },
    } as const;
  }, [hasActiveStyle, activeColor]);

  const currentStyle = showActive && hasActiveStyle ? activeStyle : passiveStyle;
  const label = showActive && activeMode !== "Off" ? "Active" : labelForMode(passiveMode);

  const handleToggle = () => {
    if (!interactive || activeMode === "Off" || !hasActiveStyle) return;
    setShowActive((prev) => !prev);
  };

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || activeMode === "Off" || !hasActiveStyle) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      setShowActive((prev) => !prev);
    }
  };

  return (
    <div
      className={`lighting-preview${currentStyle.className ? ` ${currentStyle.className}` : ""}${interactive ? " interactive" : ""}${className ? ` ${className}` : ""}`}
      style={{ width: dim, height: dim, ...(currentStyle.style ?? {}), ...(style ?? {}) }}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? showActive : undefined}
      onClick={handleToggle}
      onKeyDown={handleKey}
    >
      <div className="lighting-preview-label">
        <span>{label}</span>
      </div>
    </div>
  );
}
