import { ModalFrame } from "./ModalFrame";
import type { LedConfigurationDto } from "../../types";

type GlobalLightingModalProps = {
  closing: boolean;
  draftLedConfig: LedConfigurationDto | null;
  onChangeBrightness: (value: number) => void;
  onSave: () => void;
  onRequestClose: () => void;
  onAnimationEnd: (animationName: string) => void;
};

export function GlobalLightingModal({
  closing,
  draftLedConfig,
  onChangeBrightness,
  onSave,
  onRequestClose,
  onAnimationEnd,
}: GlobalLightingModalProps) {
  return (
    <ModalFrame
      closing={closing}
      onRequestClose={onRequestClose}
      onAnimationEnd={onAnimationEnd}
      className="lighting-modal"
    >
      <div className="modal-header">
        <div className="modal-title">Global lighting</div>
      </div>
      <div className="modal-body">
        {draftLedConfig ? (
          <div className="space-y-2">
            <div className="muted small">These settings apply to every button LED on the device.</div>
            <label className="muted small" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
              <span>Global brightness</span>
              <input
                type="range"
                min={0}
                max={100}
                value={draftLedConfig.brightnessPercent}
                onChange={(e) => onChangeBrightness(Number(e.target.value))}
              />
              <span style={{ minWidth: "36px", textAlign: "right" }}>{draftLedConfig.brightnessPercent}%</span>
            </label>
            <div className="muted small">Brightness scales both passive and active effects together.</div>
          </div>
        ) : (
          <div className="muted small">No lighting configuration available.</div>
        )}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onRequestClose}>Cancel</button>
        <button className="btn btn-primary" onClick={onSave} disabled={!draftLedConfig}>Save</button>
      </div>
    </ModalFrame>
  );
}
