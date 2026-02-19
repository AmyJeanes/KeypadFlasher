import { LightingPreview } from "../LightingPreview";
import { ModalFrame } from "./ModalFrame";
import type { ActiveLedMode, LedColor, LedConfigurationDto, PassiveLedMode } from "../../types";

type KeyLightingModalProps = {
  closing: boolean;
  draftLedConfig: LedConfigurationDto | null;
  layoutLedCount: number;
  focusLedIndex: number | null;
  lightingStatus: string;
  copiedLedLighting: boolean;
  onRequestClose: () => void;
  onAnimationEnd: (animationName: string) => void;
  onSave: () => void;
  setPassiveModeForLed: (idx: number, mode: PassiveLedMode) => void;
  setPassiveColor: (idx: number, color: LedColor) => void;
  setRainbowStepMs: (idx: number, value: number) => void;
  setBreathingMinPercent: (idx: number, value: number) => void;
  setBreathingStepMs: (idx: number, value: number) => void;
  setActiveMode: (idx: number, mode: ActiveLedMode) => void;
  setActiveColor: (idx: number, color: LedColor) => void;
  copyLedLighting: (idx: number, displayName: string) => void;
  pasteLedLighting: (idx: number, displayName: string) => void;
  applyLightingToAll: (idx: number, displayName: string) => void;
  ledDisplayName: (idx: number) => string;
};

const colorToHex = (color: LedColor): string => {
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
};

const hexToColor = (hex: string): LedColor => {
  const cleaned = (hex || "").replace("#", "");
  if (cleaned.length !== 6) return { r: 255, g: 255, b: 255 };
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return { r: 255, g: 255, b: 255 };
  return { r, g, b };
};

export function KeyLightingModal({
  closing,
  draftLedConfig,
  layoutLedCount,
  focusLedIndex,
  lightingStatus,
  copiedLedLighting,
  onRequestClose,
  onAnimationEnd,
  onSave,
  setPassiveModeForLed,
  setPassiveColor,
  setRainbowStepMs,
  setBreathingMinPercent,
  setBreathingStepMs,
  setActiveMode,
  setActiveColor,
  copyLedLighting,
  pasteLedLighting,
  applyLightingToAll,
  ledDisplayName,
}: KeyLightingModalProps) {
  const renderLightingBody = () => {
    if (layoutLedCount === 0 || !draftLedConfig) {
      return <div className="muted small">This layout has no LEDs mapped.</div>;
    }

    const target = focusLedIndex != null ? focusLedIndex : 0;
    const modalLedCount = draftLedConfig.leds.length;
    if (target < 0 || target >= modalLedCount) {
      return <div className="muted small">LED out of range.</div>;
    }

    const targetLed = draftLedConfig.leds[target];
    const passiveMode = targetLed.passiveMode;
    const activeModeValue = targetLed.activeMode;
    const modalActiveSolidEnabled = activeModeValue === "Solid";
    const previewPassiveColor = targetLed.passiveColor;
    const previewActiveColor = targetLed.activeColor;
    const selectorRowStyle = { display: "grid", gridTemplateColumns: "140px minmax(160px, 220px)", alignItems: "center", gap: "10px 12px", width: "100%" } as const;
    const pickerRowStyle = { display: "grid", gridTemplateColumns: "140px auto", alignItems: "center", gap: "10px 12px", width: "100%" } as const;
    const sliderRowStyle = { display: "grid", gridTemplateColumns: "140px 1fr 72px", alignItems: "center", gap: "10px 12px", width: "100%" } as const;

    return (
      <div id={`led-card-${target}`} className="led-grid" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div className="muted small" style={{ marginBottom: "8px" }}>
          Set the lighting modes and colors for this key.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontWeight: 600 }}>Lighting preview</div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <LightingPreview
              passiveMode={passiveMode}
              passiveColor={previewPassiveColor}
              activeMode={activeModeValue}
              activeColor={previewActiveColor}
              rainbowStepMs={targetLed.rainbowStepMs}
              breathingMinPercent={targetLed.breathingMinPercent}
              breathingStepMs={targetLed.breathingStepMs}
              ledIndex={target}
              size="md"
              interactive
              muted={false}
            />
            <div className="muted small" style={{ maxWidth: "340px" }}>
              Hold to see active lighting, release to return to passive. Does not show global brightness. Updates live when settings change.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div style={{ fontWeight: 600 }}>Passive lighting</div>
            <div className="muted small">Shows when the key is idle.</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
            <div style={selectorRowStyle}>
              <span className="muted small">Passive</span>
              <select
                value={passiveMode}
                onChange={(e) => setPassiveModeForLed(target, e.target.value as PassiveLedMode)}
              >
                <option value="Off">Off</option>
                <option value="Rainbow">Rainbow</option>
                <option value="Breathing">Breathing</option>
                <option value="Static">Static</option>
              </select>
            </div>
            {passiveMode === "Rainbow" && (
              <label className="muted small" style={sliderRowStyle}>
                <span>Rainbow step</span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={1}
                  value={targetLed.rainbowStepMs}
                  onChange={(e) => setRainbowStepMs(target, Number(e.target.value))}
                />
                <span style={{ textAlign: "right" }}>{targetLed.rainbowStepMs} ms</span>
              </label>
            )}
            {passiveMode === "Breathing" && (
              <div style={{ display: "grid", gap: "8px", width: "100%" }}>
                <label className="muted small" style={pickerRowStyle}>
                  <span>Color</span>
                  <input
                    type="color"
                    value={colorToHex(targetLed.passiveColor)}
                    onChange={(e) => setPassiveColor(target, hexToColor(e.target.value))}
                  />
                </label>
                <label className="muted small" style={sliderRowStyle}>
                  <span>Min brightness</span>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    value={targetLed.breathingMinPercent}
                    onChange={(e) => setBreathingMinPercent(target, Number(e.target.value))}
                  />
                  <span style={{ textAlign: "right" }}>{targetLed.breathingMinPercent}%</span>
                </label>
                <label className="muted small" style={sliderRowStyle}>
                  <span>Breathing step</span>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={1}
                    value={targetLed.breathingStepMs}
                    onChange={(e) => setBreathingStepMs(target, Number(e.target.value))}
                  />
                  <span style={{ textAlign: "right" }}>{targetLed.breathingStepMs} ms</span>
                </label>
              </div>
            )}
            {passiveMode === "Static" && (
              <label className="muted small" style={pickerRowStyle}>
                <span>Color</span>
                <input
                  type="color"
                  value={colorToHex(targetLed.passiveColor)}
                  onChange={(e) => setPassiveColor(target, hexToColor(e.target.value))}
                />
              </label>
            )}
            <div className="muted small" style={{ width: "100%" }}>
              Lower step values run faster, higher step values slow the animations.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ fontWeight: 600 }}>Active lighting</div>
          <div className="muted small">Shows while the key is pressed.</div>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
          <span className="muted small" style={{ minWidth: "56px" }}>Active</span>
          <select
            value={targetLed.activeMode}
            onChange={(e) => setActiveMode(target, e.target.value as ActiveLedMode)}
          >
            <option value="Off">Off</option>
            <option value="Nothing">Nothing</option>
            <option value="Solid">Solid</option>
          </select>
          {modalActiveSolidEnabled && (
            <input
              type="color"
              value={colorToHex(targetLed.activeColor)}
              onChange={(e) => setActiveColor(target, hexToColor(e.target.value))}
            />
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => copyLedLighting(target, ledDisplayName(target))}>Copy</button>
            <button className="btn" disabled={!copiedLedLighting} onClick={() => pasteLedLighting(target, ledDisplayName(target))}>Paste</button>
            <button className="btn" onClick={() => applyLightingToAll(target, ledDisplayName(target))}>Apply to all</button>
          </div>
          <div style={{ minHeight: "18px", textAlign: "right" }}>
            <span className="muted small">{lightingStatus}</span>
          </div>
        </div>
      </div>
    );
  };

  const title = (() => {
    const target = focusLedIndex != null ? focusLedIndex : 0;
    const maxIdx = draftLedConfig?.leds.length ?? 0;
    const clamped = maxIdx > 0 ? Math.min(Math.max(target, 0), maxIdx - 1) : 0;
    return maxIdx > 0 ? `Edit ${ledDisplayName(clamped)} Lighting` : "Lighting";
  })();

  return (
    <ModalFrame
      closing={closing}
      onRequestClose={onRequestClose}
      onAnimationEnd={onAnimationEnd}
      className="lighting-modal"
    >
      <div className="modal-header">
        <div className="modal-title">{title}</div>
      </div>
      <div className="modal-body">
        {renderLightingBody()}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onRequestClose}>Cancel</button>
        <button className="btn btn-primary" onClick={onSave} disabled={!draftLedConfig}>Save</button>
      </div>
    </ModalFrame>
  );
}
