import { useCallback, useEffect, useRef, useState } from "react";

export type ModalClosing = {
  isClosing: boolean;
  requestClose: () => void;
  handleAnimationEnd: (animationName: string) => void;
};

export function useModalClosing(isOpen: boolean, onClosed: () => void): ModalClosing {
  const [isClosing, setIsClosing] = useState(false);
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    pendingRef.current.clear();
    setIsClosing(false);
  }, [isOpen]);

  const requestClose = useCallback(() => {
    if (!isOpen || isClosing) return;
    pendingRef.current = new Set(["modal-pop-out", "backdrop-fade-out"]);
    setIsClosing(true);
  }, [isClosing, isOpen]);

  const handleAnimationEnd = useCallback((animationName: string) => {
    if (!isClosing) return;
    if (!pendingRef.current.has(animationName)) return;
    pendingRef.current.delete(animationName);
    if (pendingRef.current.size === 0) {
      pendingRef.current.clear();
      setIsClosing(false);
      onClosed();
    }
  }, [isClosing, onClosed]);

  return { isClosing, requestClose, handleAnimationEnd };
}