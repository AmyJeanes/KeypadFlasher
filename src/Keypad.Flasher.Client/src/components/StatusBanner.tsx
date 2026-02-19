import type { ReactNode } from "react";
import type { Progress } from "../lib/ch55xBootloader";

type StatusTone = "info" | "success" | "warn" | "error";

type StatusBannerProps = {
  tone: StatusTone;
  title: string;
  body?: ReactNode;
  progress?: Progress | null;
  showSpinner?: boolean;
};

export function StatusBanner({ tone, title, body, progress, showSpinner }: StatusBannerProps) {
  const hasProgress = Boolean(progress && progress.total > 0);
  const percent = hasProgress && progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className={`status-banner status-${tone}`}>
      <div className="status-header">
        <div className="status-title">{title}</div>
        {showSpinner && <span className="status-spinner" role="status" aria-live="polite" aria-label="Working" />}
      </div>
      {body && <div className="status-body">{body}</div>}
      {hasProgress && progress && (
        <div className="status-progress-block">
          <div className="status-progress">
            <div className="status-progress-bar" style={{ width: `${percent}%` }} />
          </div>
          <div className="status-progress-meta">{progress.phase} {progress.current} / {progress.total}</div>
        </div>
      )}
    </div>
  );
}
