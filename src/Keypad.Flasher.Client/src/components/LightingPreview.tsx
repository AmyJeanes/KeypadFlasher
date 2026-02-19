import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { LedColor, PassiveLedMode, ActiveLedMode } from "../types";
import { getPassiveLightingStyle } from "./lightingStyles";

type LightingPreviewProps = {
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

export function LightingPreview({ passiveMode, passiveColor, activeMode = "Solid", activeColor, rainbowStepMs, breathingMinPercent, breathingStepMs, ledIndex = 0, size = "md", interactive = false, muted = true, className = "", style }: LightingPreviewProps) {
  const [showActive, setShowActive] = useState(false);
  const dim = size === "sm" ? 64 : 80;

  const hasActiveStyle = (activeMode === "Solid" && Boolean(activeColor)) || activeMode === "Off";

  useEffect(() => {
    if (!interactive || !hasActiveStyle) {
      setShowActive(false);
    }
  }, [interactive, hasActiveStyle]);

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
    if (!hasActiveStyle) return {} as const;
    if (activeMode === "Off") {
      return {
        className: "active",
        style: {
          background: "#000",
          backgroundImage: "none",
          borderColor: "rgba(0,0,0,0.7)",
        },
      } as const;
    }
    if (!activeColor) return {} as const;
    return {
      className: "active",
      style: {
        background: "var(--card-bg)",
        backgroundImage: `linear-gradient(145deg, rgba(${activeColor.r}, ${activeColor.g}, ${activeColor.b}, 0.9), rgba(${activeColor.r}, ${activeColor.g}, ${activeColor.b}, 0.65))`,
        borderColor: `rgba(${activeColor.r}, ${activeColor.g}, ${activeColor.b}, 0.7)`
      },
    } as const;
  }, [hasActiveStyle, activeMode, activeColor]);

  const startActive = () => {
    if (!interactive || !hasActiveStyle) return;
    setShowActive(true);
  };

  const stopActive = () => {
    if (!interactive || !hasActiveStyle) return;
    setShowActive(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || !hasActiveStyle) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      startActive();
    }
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || !hasActiveStyle) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      stopActive();
    }
  };

  const containerClass = `lighting-preview${passiveStyle.className ? ` ${passiveStyle.className}` : ""}${interactive ? " interactive" : ""}${className ? ` ${className}` : ""}`;
  const passiveSurfaceClass = `lighting-preview-surface passive${passiveStyle.className ? ` ${passiveStyle.className}` : ""}`;
  const activeSurfaceClass = `lighting-preview-surface active${activeStyle.className ? ` ${activeStyle.className}` : ""}`;

  return (
    <div
      className={containerClass}
      style={{ width: dim, height: dim, ...(passiveStyle.style ?? {}), ...(style ?? {}) }}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? showActive : undefined}
      aria-label={interactive ? "Lighting preview. Hold to see active color." : "Lighting preview"}
      onPointerDown={startActive}
      onPointerUp={stopActive}
      onPointerLeave={stopActive}
      onPointerCancel={stopActive}
      onBlur={stopActive}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <div className={passiveSurfaceClass} style={passiveStyle.style} />
      {hasActiveStyle && (
        <div
          className={activeSurfaceClass}
          style={{ ...(activeStyle.style ?? {}), opacity: showActive ? 1 : 0 }}
        />
      )}
    </div>
  );
}
