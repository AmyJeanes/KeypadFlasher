import type { ReactNode } from "react";

type ConnectSpinnerProps = {
  title?: string;
  subtitle?: ReactNode;
  inline?: boolean;
  warning?: string | null;
  closing?: boolean;
  onAnimationEnd?: (animationName: string) => void;
};

export function ConnectSpinner({
  inline = false,
  warning,
  closing = false,
  onAnimationEnd,
}: ConnectSpinnerProps) {
  const spinnerContent = (
    <div className="connect-spinner-core">
      <div className="spinner" aria-hidden="true">
        <div className="spinner-circle" />
      </div>
      <div className="connect-spinner-title">Requesting device…</div>
      <div className="muted small connect-spinner-subtitle">Check the browser popup and select your device to continue</div>
      <div className="muted small connect-spinner-subtitle">Ensure the device is connected and in bootloader mode</div>
    </div>
  );

  if (inline) {
    return (
      <div className="connect-spinner-inline">
        {warning && (
          <div className="status-banner status-warn connect-spinner-warning">
            <div className="status-title">Connection failed</div>
            <div className="status-body">{warning}</div>
          </div>
        )}
        <div className="connect-spinner-card" aria-label="Connecting to device">
          {spinnerContent}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`modal-backdrop${closing ? " closing" : ""}`}
      role="status"
      aria-live="polite"
      onAnimationEnd={(e) => onAnimationEnd?.(e.animationName)}
    >
      <div
        className={`modal connect-spinner-modal${closing ? " closing" : ""}`}
        aria-label="Connecting to device"
        onAnimationEnd={(e) => onAnimationEnd?.(e.animationName)}
      >
        {spinnerContent}
      </div>
    </div>
  );
}
