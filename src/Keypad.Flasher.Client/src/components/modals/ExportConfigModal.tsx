import { ModalFrame } from "./ModalFrame";

type ExportConfigModalProps = {
  closing: boolean;
  exportText: string;
  exportCopyFlash: boolean;
  exportCopyStatus: string;
  onCopy: () => void;
  onRequestClose: () => void;
  onAnimationEnd: (animationName: string) => void;
};

export function ExportConfigModal({
  closing,
  exportText,
  exportCopyFlash,
  exportCopyStatus,
  onCopy,
  onRequestClose,
  onAnimationEnd,
}: ExportConfigModalProps) {
  return (
    <ModalFrame
      closing={closing}
      onRequestClose={onRequestClose}
      onAnimationEnd={onAnimationEnd}
      className="config-modal"
    >
      <div className="modal-header">
        <div className="modal-title">Export configuration</div>
      </div>
      <div className="modal-body">
        <p className="muted small">Click the block to copy. This includes layout, bindings, and lighting.</p>
        <pre
          className={`code-block clickable${exportCopyFlash ? " code-block-flash" : ""}`}
          onClick={onCopy}
          title="Click to copy"
          aria-label="Exported configuration JSON"
        >{exportText}</pre>
        <div className="muted small" style={{ minHeight: "18px" }}>{exportCopyStatus}</div>
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onRequestClose}>Close</button>
      </div>
    </ModalFrame>
  );
}
