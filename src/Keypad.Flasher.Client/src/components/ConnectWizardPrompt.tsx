import { useRef } from "react";
import { useModalClosing } from "../hooks/useModalClosing";

type ConnectWizardPromptProps = {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConnectWizardPrompt({ isOpen, onCancel, onConfirm }: ConnectWizardPromptProps) {
  const modalPointerDownRef = useRef<boolean>(false);
  const promptModal = useModalClosing(isOpen, onCancel);
  const { isClosing, requestClose, handleAnimationEnd } = promptModal;

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={`modal-backdrop${isClosing ? " closing" : ""}`}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (modalPointerDownRef.current) { modalPointerDownRef.current = false; return; }
        if (e.target === e.currentTarget) requestClose();
      }}
      onAnimationEnd={(e) => handleAnimationEnd(e.animationName)}
    >
      <div
        className={`modal config-modal${isClosing ? " closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={() => { modalPointerDownRef.current = true; }}
        onMouseUp={() => { modalPointerDownRef.current = false; }}
        onAnimationEnd={(e) => handleAnimationEnd(e.animationName)}
      >
        <div className="modal-header">
          <div className="modal-title">Connection unsuccessful</div>
        </div>
        <div className="modal-body">
          <p className="muted small">Would you like to open the connection wizard to troubleshoot the issue?</p>
        </div>
        <div className="modal-actions" style={{ justifyContent: "flex-end", gap: "8px" }}>
          <button className="btn" onClick={requestClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { onConfirm(); requestClose(); }}>Open wizard</button>
        </div>
      </div>
    </div>
  );
}