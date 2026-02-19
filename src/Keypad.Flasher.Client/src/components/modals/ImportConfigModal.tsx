import type { RefObject } from "react";
import { ModalFrame } from "./ModalFrame";

type ImportConfigModalProps = {
  closing: boolean;
  importText: string;
  importError: string;
  textAreaRef: RefObject<HTMLTextAreaElement | null>;
  onChangeText: (value: string) => void;
  onImport: () => void;
  onRequestClose: () => void;
  onAnimationEnd: (animationName: string) => void;
};

export function ImportConfigModal({
  closing,
  importText,
  importError,
  textAreaRef,
  onChangeText,
  onImport,
  onRequestClose,
  onAnimationEnd,
}: ImportConfigModalProps) {
  return (
    <ModalFrame
      closing={closing}
      onRequestClose={onRequestClose}
      onAnimationEnd={onAnimationEnd}
      className="config-modal"
    >
      <div className="modal-header">
        <div className="modal-title">Import configuration</div>
      </div>
      <div className="modal-body">
        <p className="muted small">Paste an exported configuration below. It will replace the current layout, bindings, and lighting.</p>
        <textarea
          className="code-block text-area"
          style={{ width: "100%", minHeight: "220px" }}
          ref={textAreaRef}
          value={importText}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="Paste configuration JSON here"
        />
        {importError && (
          <div className="status-banner status-error" style={{ marginTop: "8px" }}>
            <div className="status-title">Import error</div>
            <div className="status-body">{importError}</div>
          </div>
        )}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onRequestClose}>Cancel</button>
        <button className="btn btn-primary" onClick={onImport}>Import</button>
      </div>
    </ModalFrame>
  );
}
