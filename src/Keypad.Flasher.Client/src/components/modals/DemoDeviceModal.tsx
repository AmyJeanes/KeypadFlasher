import { ModalFrame } from "./ModalFrame";

type DemoOption = {
  key: string;
  name: string;
};

type DemoDeviceModalProps = {
  closing: boolean;
  options: DemoOption[];
  selectedKey: string | null;
  onSelectKey: (key: string) => void;
  onStart: () => void;
  onRequestClose: () => void;
  onAnimationEnd: (animationName: string) => void;
};

export function DemoDeviceModal({
  closing,
  options,
  selectedKey,
  onSelectKey,
  onStart,
  onRequestClose,
  onAnimationEnd,
}: DemoDeviceModalProps) {
  return (
    <ModalFrame
      closing={closing}
      onRequestClose={onRequestClose}
      onAnimationEnd={onAnimationEnd}
      className="config-modal demo-modal"
    >
      <div className="modal-header">
        <div className="modal-title">Choose a demo device</div>
      </div>
      <div className="modal-body">
        <p className="muted small">Pick a supported device profile to explore the UI without connecting hardware.</p>
        {options.length === 0 ? (
          <div className="muted small">No demo devices available.</div>
        ) : (
          <div className="space-y-2">
            {options.map((opt) => (
              <label key={opt.key} className={`demo-option${selectedKey === opt.key ? " demo-option-selected" : ""}`}>
                <input
                  type="radio"
                  name="demo-device"
                  value={opt.key}
                  checked={selectedKey === opt.key}
                  onChange={() => onSelectKey(opt.key)}
                />
                <div className="demo-option-body">
                  <div className="demo-option-name">{opt.name}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onRequestClose}>Cancel</button>
        <button className="btn btn-primary" onClick={onStart} disabled={!selectedKey || options.length === 0}>Start demo</button>
      </div>
    </ModalFrame>
  );
}
