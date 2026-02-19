import { type ReactNode, useRef } from "react";

export type ModalFrameProps = {
  closing: boolean;
  onRequestClose: () => void;
  onAnimationEnd?: (animationName: string) => void;
  className?: string;
  backdropClassName?: string;
  role?: "dialog" | "alertdialog";
  children: ReactNode;
};

export function ModalFrame({
  closing,
  onRequestClose,
  onAnimationEnd,
  className,
  backdropClassName,
  role = "dialog",
  children,
}: ModalFrameProps) {
  const pointerDownRef = useRef(false);
  const backdropClasses = ["modal-backdrop", closing ? " closing" : "", backdropClassName ? ` ${backdropClassName}` : ""]
    .join("");
  const modalClasses = ["modal", className ? ` ${className}` : "", closing ? " closing" : ""].join("");

  return (
    <div
      className={backdropClasses}
      role={role}
      aria-modal="true"
      onClick={(e) => {
        if (pointerDownRef.current) { pointerDownRef.current = false; return; }
        if (e.target === e.currentTarget) onRequestClose();
      }}
      onAnimationEnd={(e) => onAnimationEnd?.(e.animationName)}
    >
      <div
        className={modalClasses}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={() => { pointerDownRef.current = true; }}
        onMouseUp={() => { pointerDownRef.current = false; }}
        onAnimationEnd={(e) => onAnimationEnd?.(e.animationName)}
      >
        {children}
      </div>
    </div>
  );
}
