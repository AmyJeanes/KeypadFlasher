import { useCallback, useEffect, useRef, useState } from "react";

export type ToastMessage = { message: string; tone: "info" | "success" | "warn" | "error" };

export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, tone: ToastMessage["tone"] = "info", durationMs = 3200) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ message, tone });
    toastTimerRef.current = window.setTimeout(() => setToast(null), durationMs);
  }, []);

  const clearToast = useCallback(() => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(null);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  return { toast, showToast, clearToast } as const;
}
