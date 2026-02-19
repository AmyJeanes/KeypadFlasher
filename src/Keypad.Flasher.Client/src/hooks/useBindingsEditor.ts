import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { BindingProfileDto, DeviceLayoutDto, HidBindingDto, HidStepDto } from "../lib/keypadConfigs";
import type { EditTarget } from "../types";

type UseBindingsEditorParams = {
  currentBindings: BindingProfileDto | null;
  setCurrentBindings: Dispatch<SetStateAction<BindingProfileDto | null>>;
  setSelectedLayout: Dispatch<SetStateAction<DeviceLayoutDto | null>>;
};

type UseBindingsEditorResult = {
  editorTarget: EditTarget | null;
  editorBinding: HidBindingDto | null;
  stepClipboard: HidStepDto[] | null;
  setStepClipboard: Dispatch<SetStateAction<HidStepDto[] | null>>;
  openEdit: (target: EditTarget) => void;
  handleEditorSave: (binding: HidBindingDto) => void;
  handleEditorClose: () => void;
  updateBootloaderOnBoot: (target: EditTarget, value: boolean) => void;
  updateBootloaderChordMember: (target: EditTarget, value: boolean) => void;
};

export function useBindingsEditor(params: UseBindingsEditorParams): UseBindingsEditorResult {
  const { currentBindings, setCurrentBindings, setSelectedLayout } = params;
  const [editorTarget, setEditorTarget] = useState<EditTarget | null>(null);
  const [editorBinding, setEditorBinding] = useState<HidBindingDto | null>(null);
  const [stepClipboard, setStepClipboard] = useState<HidStepDto[] | null>(null);

  const openEdit = useCallback((target: EditTarget) => {
    setEditorTarget(target);
    const binding = (() => {
      if (!currentBindings) return null;
      if (target.type === "button") {
        return currentBindings.buttons.find((b) => b.id === target.buttonId)?.binding ?? null;
      }
      const enc = currentBindings.encoders.find((e) => e.id === target.encoderId);
      if (!enc) return null;
      if (target.direction === "cw") return enc.clockwise;
      if (target.direction === "ccw") return enc.counterClockwise;
      return enc.press ?? null;
    })();
    setEditorBinding(binding);
  }, [currentBindings]);

  const handleEditorSave = useCallback((binding: HidBindingDto) => {
    if (!editorTarget || !currentBindings) return;
    if (editorTarget.type === "button") {
      const other = currentBindings.buttons.filter((b) => b.id !== editorTarget.buttonId);
      setCurrentBindings({
        ...currentBindings,
        buttons: [...other, { id: editorTarget.buttonId, binding }].sort((a, b) => a.id - b.id),
      });
      return;
    }

    const existing = currentBindings.encoders.find((e) => e.id === editorTarget.encoderId);
    const others = currentBindings.encoders.filter((e) => e.id !== editorTarget.encoderId);
    const updated = existing
      ? { ...existing }
      : { id: editorTarget.encoderId, clockwise: binding, counterClockwise: binding };

    if (editorTarget.direction === "cw") updated.clockwise = binding;
    if (editorTarget.direction === "ccw") updated.counterClockwise = binding;
    if (editorTarget.direction === "press") updated.press = binding;

    setCurrentBindings({ ...currentBindings, encoders: [...others, updated].sort((a, b) => a.id - b.id) });
  }, [currentBindings, editorTarget, setCurrentBindings]);

  const handleEditorClose = useCallback(() => {
    setEditorTarget(null);
    setEditorBinding(null);
  }, []);

  const updateBootloaderOnBoot = useCallback((target: EditTarget, value: boolean) => {
    setSelectedLayout((prev) => {
      if (!prev) return prev;
      if (target.type === "button") {
        return {
          ...prev,
          buttons: prev.buttons.map((b) => (b.id === target.buttonId ? { ...b, bootloaderOnBoot: value } : b)),
        };
      }
      if (target.type === "encoder" && target.direction === "press") {
        return {
          ...prev,
          encoders: prev.encoders.map((e) => (e.id === target.encoderId && e.press
            ? { ...e, press: { ...e.press, bootloaderOnBoot: value } }
            : e)),
        };
      }
      return prev;
    });
  }, [setSelectedLayout]);

  const updateBootloaderChordMember = useCallback((target: EditTarget, value: boolean) => {
    setSelectedLayout((prev) => {
      if (!prev) return prev;
      if (target.type === "button") {
        return {
          ...prev,
          buttons: prev.buttons.map((b) => (b.id === target.buttonId ? { ...b, bootloaderChordMember: value } : b)),
        };
      }
      if (target.type === "encoder" && target.direction === "press") {
        return {
          ...prev,
          encoders: prev.encoders.map((e) => (e.id === target.encoderId && e.press
            ? { ...e, press: { ...e.press, bootloaderChordMember: value } }
            : e)),
        };
      }
      return prev;
    });
  }, [setSelectedLayout]);

  return {
    editorTarget,
    editorBinding,
    stepClipboard,
    setStepClipboard,
    openEdit,
    handleEditorSave,
    handleEditorClose,
    updateBootloaderOnBoot,
    updateBootloaderChordMember,
  };
}
