import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { HidBindingDto, HidPointerType, HidStepDto } from "../lib/keypadConfigs";
import { HID_POINTER_TYPE } from "../lib/keypadConfigs";
import {
  DEFAULT_FUNCTION_POINTER,
  FUNCTIONS_WITH_VALUE,
  FRIENDLY_FUNCTIONS,
  KEY_OPTION_GROUPS,
  KEY_OPTION_LOOKUP,
  MODIFIER_BITS,
  defaultMouseValue,
  describeStep,
  captureKeyboardEventToKey,
  keyLabelFromCode,
  normalizeIncomingStep,
} from "../lib/bindingUtils";
import type { EditTarget } from "../types";
import "./StepEditor.css";

type StepEditorProps = {
  target: EditTarget | null;
  binding: HidBindingDto | undefined | null;
  stepClipboard: HidStepDto[] | null;
  onSave: (binding: HidBindingDto) => void;
  onClose: () => void;
  onUpdateStepClipboard: (steps: HidStepDto[]) => void;
  onError: (detail: string) => void;
};

const useStableStepIds = () => {
  const stepIdMap = useRef<WeakMap<HidStepDto, string>>(new WeakMap());
  const getStepId = useCallback((step: HidStepDto): string => {
    const existing = stepIdMap.current.get(step);
    if (existing) return existing;
    const generated = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `step-${Math.random().toString(36).slice(2)}`;
    stepIdMap.current.set(step, generated);
    return generated;
  }, []);

  const cloneStepWithId = useCallback((prevStep: HidStepDto, nextStep: HidStepDto): HidStepDto => {
    const id = getStepId(prevStep);
    stepIdMap.current.set(nextStep, id);
    return nextStep;
  }, [getStepId]);

  return { getStepId, cloneStepWithId };
};

export function StepEditor({
  target,
  binding,
  stepClipboard,
  onSave,
  onClose,
  onUpdateStepClipboard,
}: StepEditorProps) {
  const { getStepId, cloneStepWithId } = useStableStepIds();
  const [editSteps, setEditSteps] = useState<HidStepDto[]>([]);
  const [capturingStepIndex, setCapturingStepIndex] = useState<number | null>(null);
  const [selectedStepIndices, setSelectedStepIndices] = useState<number[]>([]);
  const [draggingStepIndex, setDraggingStepIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [freshSteps, setFreshSteps] = useState<string[]>([]);
  const [stepHeights, setStepHeights] = useState<Record<string, number>>({});
  const [dragRestoreStep, setDragRestoreStep] = useState<HidStepDto | null>(null);
  const [highlightedSteps, setHighlightedSteps] = useState<number[]>([]);
  const [removingStepIds, setRemovingStepIds] = useState<string[]>([]);
  const [isClosingModal, setIsClosingModal] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string>("");

  const hiddenKeyInputRef = useRef<HTMLInputElement | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const removeTimerRef = useRef<Map<string, number>>(new Map());
  const modalClosePendingRef = useRef<Set<string>>(new Set());
  const stepBodyRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const stepCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const stepsScrollRef = useRef<HTMLDivElement | null>(null);

  const resetModalClosePending = () => {
    modalClosePendingRef.current.clear();
  };

  useEffect(() => () => {
    if (highlightTimerRef.current != null) window.clearTimeout(highlightTimerRef.current);
    removeTimerRef.current.forEach((id) => window.clearTimeout(id));
    removeTimerRef.current.clear();
    resetModalClosePending();
  }, []);

  useEffect(() => {
    if (!localError) return undefined;
    const timer = window.setTimeout(() => setLocalError(""), 2200);
    return () => window.clearTimeout(timer);
  }, [localError]);

  useEffect(() => {
    if (!target) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (capturingStepIndex != null) return;
        event.preventDefault();
        requestClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [target, capturingStepIndex]);

  useEffect(() => {
    if (!target) return;
    const nextSteps: HidStepDto[] = (() => {
      if (binding?.type === "Sequence" && binding.steps) {
        return binding.steps.map(normalizeIncomingStep);
      }
      return [];
    })();
    setEditSteps(nextSteps);
    setActiveStepIndex(nextSteps.length > 0 ? 0 : null);
    setSelectedStepIndices([]);
    setDraggingStepIndex(null);
    setDragOverIndex(null);
    setFreshSteps([]);
    setRemovingStepIds([]);
    setCapturingStepIndex(null);
    setIsClosingModal(false);
    resetModalClosePending();
  }, [binding, target]);

  useEffect(() => {
    if (!target) return;
    if (capturingStepIndex == null) return;
    const input = hiddenKeyInputRef.current;
    if (input) {
      input.focus();
      input.value = "";
    }

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      const pureModifier = event.code === "ShiftLeft" || event.code === "ShiftRight" || event.code === "ControlLeft" || event.code === "ControlRight" || event.code === "AltLeft" || event.code === "AltRight" || event.code === "MetaLeft" || event.code === "MetaRight";
      if (pureModifier) return; // keep waiting for an actual key while modifiers are held
      const captured = captureKeyboardEventToKey(event);
      if (!captured) {
        setLocalError("Could not capture that key. Pick it from the list or try a different key.");
        setCapturingStepIndex(null);
        input?.blur();
        return;
      }
      setEditSteps((prev) => prev.map((s, i) => {
        if (i !== capturingStepIndex) return s;
        if (s.kind !== "Key") return s;
        const nextStep: HidStepDto = { ...s, keycode: captured.keycode, modifiers: captured.modifiers };
        return cloneStepWithId(s, nextStep);
      }));
      setCapturingStepIndex(null);
      input?.blur();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      input?.blur();
    };
  }, [capturingStepIndex, cloneStepWithId, target]);

  useEffect(() => {
    if (freshSteps.length === 0) return undefined;
    const timer = window.setTimeout(() => setFreshSteps([]), 1200);
    return () => window.clearTimeout(timer);
  }, [freshSteps]);

  useEffect(() => {
    if (activeStepIndex == null) return;
    const step = editSteps[activeStepIndex];
    if (!step) return;
    const id = getStepId(step);
    const cardEl = stepCardRefs.current.get(id);
    if (cardEl) {
      cardEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeStepIndex, editSteps, getStepId]);

  useLayoutEffect(() => {
    const heights: Record<string, number> = {};
    stepBodyRefs.current.forEach((el, key) => {
      heights[key] = el.scrollHeight;
    });
    setStepHeights((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.keys(heights).forEach((key) => {
        const h = heights[key];
        if (next[key] !== h) {
          next[key] = h;
          changed = true;
        }
      });
      Object.keys(next).forEach((key) => {
        if (!(key in heights)) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [editSteps, activeStepIndex]);

  useEffect(() => {
    if (editSteps.length === 0) {
      setActiveStepIndex(null);
      return;
    }
    setActiveStepIndex((prev) => {
      if (prev == null) return prev;
      if (prev >= editSteps.length) return Math.max(editSteps.length - 1, 0);
      return prev;
    });
  }, [editSteps]);

  const scheduleHighlight = (indices: number[]) => {
    if (!indices || indices.length === 0) return;
    if (highlightTimerRef.current != null) window.clearTimeout(highlightTimerRef.current);
    setHighlightedSteps(indices);
    highlightTimerRef.current = window.setTimeout(() => setHighlightedSteps([]), 450);
  };

  const toggleStepSelection = (index: number) => {
    setSelectedStepIndices((prev) => {
      const exists = prev.includes(index);
      const next = exists ? prev.filter((i) => i !== index) : [...prev, index];
      return next.sort((a, b) => a - b);
    });
    setActiveStepIndex(null);
  };

  const selectAllSteps = () => {
    setSelectedStepIndices(editSteps.map((_, idx) => idx));
    setActiveStepIndex(null);
  };

  const clearSelectedSteps = () => {
    setSelectedStepIndices([]);
    setActiveStepIndex((prev) => (prev != null ? prev : null));
  };

  const addKeyStep = () => {
    setEditSteps((prev) => {
      const nextStep: HidStepDto = { kind: "Key", keycode: 97, modifiers: 0, holdMs: 10, gapMs: 10 };
      const next = [...prev, nextStep];
      const newIdx = next.length - 1;
      const newId = getStepId(nextStep);
      scheduleHighlight([newIdx]);
      setActiveStepIndex(newIdx);
      setFreshSteps((prevFresh) => [...prevFresh, newId]);
      return next;
    });
  };

  const addDelayStep = () => {
    setEditSteps((prev) => {
      const nextStep: HidStepDto = { kind: "Pause", gapMs: 100 };
      const next = [...prev, nextStep];
      const newIdx = next.length - 1;
      const newId = getStepId(nextStep);
      scheduleHighlight([newIdx]);
      setActiveStepIndex(newIdx);
      setFreshSteps((prevFresh) => [...prevFresh, newId]);
      return next;
    });
  };

  const addFunctionStep = () => {
    setEditSteps((prev) => {
      const nextStep: HidStepDto = { kind: "Function", functionPointer: DEFAULT_FUNCTION_POINTER, functionValue: 1, gapMs: 0 };
      const next = [...prev, nextStep];
      const newIdx = next.length - 1;
      const newId = getStepId(nextStep);
      scheduleHighlight([newIdx]);
      setActiveStepIndex(newIdx);
      setFreshSteps((prevFresh) => [...prevFresh, newId]);
      return next;
    });
  };

  const removeSelectedSteps = () => {
    const validRemovals = Array.from(new Set(selectedStepIndices)).filter((i) => i >= 0 && i < editSteps.length).sort((a, b) => a - b);
    if (validRemovals.length === 0) return;
    validRemovals.forEach((idx) => {
      const id = getStepId(editSteps[idx]);
      startRemoveById(id);
    });
    setSelectedStepIndices([]);
  };

  const isInteractiveElement = (targetEl: EventTarget | null): boolean => {
    if (!targetEl || !(targetEl as HTMLElement).closest) return false;
    const elem = targetEl as HTMLElement;
    if (elem.closest("button, input, select, option, textarea, label")) return true;
    if (elem.closest(".drag-handle")) return true;
    return false;
  };

  const toggleStepCollapse = (index: number) => {
    setActiveStepIndex((prev) => (prev === index ? null : index));
  };

  const moveSteps = (sourceIndices: number[], targetIndex: number, afterMove?: (newIndices: number[], nextSteps: HidStepDto[]) => void, keepSelection: boolean = true) => {
    setEditSteps((prev) => {
      if (prev.length === 0) return prev;
      const unique = Array.from(new Set(sourceIndices)).filter((idx) => idx >= 0 && idx < prev.length).sort((a, b) => a - b);
      if (unique.length === 0) return prev;
      const moving = unique.map((idx) => prev[idx]);
      const movingStart = unique[0];
      const droppingAfter = targetIndex >= movingStart;
      let insertAt = droppingAfter ? targetIndex + 1 : targetIndex;
      const remaining = prev.filter((_, idx) => !unique.includes(idx));
      const removedBefore = unique.filter((idx) => idx < insertAt).length;
      insertAt = Math.min(Math.max(insertAt - removedBefore, 0), remaining.length);
      const next = [...remaining.slice(0, insertAt), ...moving, ...remaining.slice(insertAt)];
      const movedIndices = moving.map((_, offset) => insertAt + offset);
      const movedIds = moving.map((s) => getStepId(s));
      if (keepSelection) {
        setSelectedStepIndices(movedIndices);
      }
      setFreshSteps((prevFresh) => {
        const seen = new Set(prevFresh);
        const merged = [...prevFresh];
        movedIds.forEach((id) => {
          if (!seen.has(id)) merged.push(id);
        });
        return merged;
      });
      scheduleHighlight(movedIndices);
      afterMove?.(movedIndices, next);
      return next;
    });
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    setDragRestoreStep(activeStepIndex === index ? editSteps[index] : null);
    setActiveStepIndex(null);
    setDraggingStepIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    event.preventDefault();
    setDragOverIndex(targetIndex);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    event.preventDefault();
    const moveGroup = selectedStepIndices.length > 0 && (draggingStepIndex == null || selectedStepIndices.includes(draggingStepIndex))
      ? selectedStepIndices
      : (draggingStepIndex != null ? [draggingStepIndex] : []);
    if (moveGroup.length > 0) {
      let dropIndex = targetIndex;
      if (moveGroup.includes(targetIndex)) {
        const maxSel = Math.max(...moveGroup);
        const nextNonSelected = editSteps.findIndex((_, i) => i > maxSel && !moveGroup.includes(i));
        dropIndex = nextNonSelected === -1 ? editSteps.length : nextNonSelected;
      }
      const restoreRef = dragRestoreStep;
      const hadSelection = selectedStepIndices.length > 0;
      moveSteps(moveGroup, dropIndex, (_newIndices, nextSteps) => {
        if (!restoreRef) {
          setActiveStepIndex(null);
          return;
        }
        const newIdx = nextSteps.findIndex((s) => s === restoreRef);
        setActiveStepIndex(newIdx >= 0 ? newIdx : null);
        setDragRestoreStep(null);
      }, hadSelection);
    }
    setDragOverIndex(null);
    setDraggingStepIndex(null);
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
    setDraggingStepIndex(null);
    setDragRestoreStep(null);
  };

  const copyStepsToClipboard = () => {
    if (editSteps.length === 0) return;
    const indices = (selectedStepIndices.length > 0 ? selectedStepIndices : editSteps.map((_, idx) => idx))
      .filter((i) => i >= 0 && i < editSteps.length);
    const copied = indices.map((i) => editSteps[i]);
    const serialized = JSON.parse(JSON.stringify(copied)) as HidStepDto[]; // deep copy to decouple edits
    const normalized = serialized.map((s) => normalizeIncomingStep(s));
    onUpdateStepClipboard(normalized);
  };

  const pasteStepsFromClipboard = () => {
    if (!stepClipboard || stepClipboard.length === 0) {
      setLocalError("Nothing to paste yet. Copy steps first.");
      return;
    }
    const normalized = stepClipboard.map((s) => normalizeIncomingStep(s));
    setEditSteps((prev) => {
      const insertAt = prev.length;
      const activeRef = activeStepIndex != null ? prev[activeStepIndex] : null;
      const next = [...prev, ...normalized];
      const newIndices = normalized.map((_: HidStepDto, offset: number) => insertAt + offset);
      const newIds = normalized.map((s: HidStepDto) => getStepId(s));
      if (activeRef) {
        const found = next.findIndex((s) => s === activeRef);
        setActiveStepIndex(found >= 0 ? found : null);
      }
      if (newIndices.length > 0) {
        setActiveStepIndex(newIndices[newIndices.length - 1]);
      }
      setSelectedStepIndices((prevSel) => prevSel);
      setFreshSteps((prevFresh) => [...prevFresh, ...newIds]);
      scheduleHighlight(newIndices);
      return next;
    });
  };

  const performRemoveById = useCallback((stepId: string) => {
    setEditSteps((prev) => {
      const prevActive = activeStepIndex;
      const activeRef = prevActive != null ? prev[prevActive] : null;
      const removeIndex = prev.findIndex((s) => getStepId(s) === stepId);
      if (removeIndex === -1) return prev;
      const next = prev.filter((_, i) => i !== removeIndex);
      setSelectedStepIndices((prevSel) => prevSel.filter((i) => i !== removeIndex).map((i) => (i > removeIndex ? i - 1 : i)));
      setActiveStepIndex(() => {
        if (activeRef) {
          const found = next.findIndex((s) => s === activeRef);
          if (found >= 0) return found;
        }
        if (prevActive != null && prevActive < removeIndex) return prevActive;
        if (prevActive != null && prevActive > removeIndex) return prevActive - 1;
        return null;
      });
      return next;
    });
    setRemovingStepIds((prev) => prev.filter((id) => id !== stepId));
    const timer = removeTimerRef.current.get(stepId);
    if (timer != null) {
      window.clearTimeout(timer);
      removeTimerRef.current.delete(stepId);
    }
  }, [activeStepIndex, getStepId]);

  const startRemoveById = (stepId: string) => {
    if (removingStepIds.includes(stepId)) return;
    setRemovingStepIds((prev) => [...prev, stepId]);
    if (removeTimerRef.current.has(stepId)) {
      const existing = removeTimerRef.current.get(stepId);
      if (existing != null) window.clearTimeout(existing);
      removeTimerRef.current.delete(stepId);
    }
    const timerId = window.setTimeout(() => performRemoveById(stepId), 1000);
    removeTimerRef.current.set(stepId, timerId);
  };

  const removeStep = (index: number) => {
    if (index < 0 || index >= editSteps.length) return;
    const id = getStepId(editSteps[index]);
    startRemoveById(id);
  };

  const handleCardAnimationEnd = (stepId: string, event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.animationName === "step-remove" && removingStepIds.includes(stepId)) {
      const timer = removeTimerRef.current.get(stepId);
      if (timer != null) {
        window.clearTimeout(timer);
        removeTimerRef.current.delete(stepId);
      }
      performRemoveById(stepId);
      return;
    }
    if (event.animationName === "step-in" && freshSteps.includes(stepId)) {
      setFreshSteps((prev) => prev.filter((i) => i !== stepId));
    }
  };

  const duplicateStep = (index: number) => {
    setEditSteps((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const clone = { ...prev[index] } as HidStepDto;
      const next = [...prev.slice(0, index + 1), clone, ...prev.slice(index + 1)];
      const newIndex = index + 1;
      setSelectedStepIndices([]);
      setActiveStepIndex(newIndex);
      setFreshSteps((prevFresh) => [...prevFresh, getStepId(clone)]);
      scheduleHighlight([newIndex]);
      return next;
    });
  };

  const toggleStepModifier = (index: number, bit: number) => {
    setEditSteps((prev) => prev.map((s, i) => {
      if (i !== index || s.kind !== "Key") return s;
      const nextStep: HidStepDto = { ...s, modifiers: (s.modifiers & bit) !== 0 ? (s.modifiers & ~bit) : (s.modifiers | bit) };
      return cloneStepWithId(s, nextStep);
    }));
  };

  const updateFunctionValue = (index: number, value: string) => {
    const parsed = Number(value);
    const nextValue = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    setEditSteps((prev) => prev.map((s, i) => {
      if (i !== index || s.kind !== "Function") return s;
      const nextStep: HidStepDto = { ...s, functionValue: nextValue };
      return cloneStepWithId(s, nextStep);
    }));
  };

  const updateStepTiming = (index: number, field: "holdMs" | "gapMs", value: string) => {
    const parsed = Number(value);
    const nextValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setEditSteps((prev) => prev.map((s, i) => {
      if (i !== index) return s;
      if (s.kind === "Key") {
        return cloneStepWithId(s, { ...s, [field]: nextValue } as HidStepDto);
      }
      if (field === "gapMs" && s.kind === "Pause") {
        return cloneStepWithId(s, { ...s, gapMs: nextValue });
      }
      if (field === "gapMs" && s.kind === "Function") {
        return cloneStepWithId(s, { ...s, gapMs: nextValue });
      }
      if (field === "gapMs" && s.kind === "Mouse") {
        return cloneStepWithId(s, { ...s, gapMs: nextValue });
      }
      return s;
    }));
  };

  const setStepKind = (index: number, kind: HidStepDto["kind"]) => {
    setEditSteps((prev) => prev.map((s, i) => {
      if (i !== index) return s;
      if (kind === "Key") {
        const keycode = s.kind === "Key" ? s.keycode : 97;
        const holdMs = s.kind === "Key" && s.holdMs > 0 ? s.holdMs : 10;
        const gapMs = s.kind === "Key" && s.gapMs > 0 ? s.gapMs : 10;
        return cloneStepWithId(s, { kind: "Key", keycode, modifiers: s.kind === "Key" ? s.modifiers : 0, holdMs, gapMs });
      }
      if (kind === "Pause") {
        const gapMs = s.kind === "Key" || s.kind === "Function" || s.kind === "Mouse" ? (s.gapMs > 0 ? s.gapMs : 100) : s.gapMs;
        return cloneStepWithId(s, { kind: "Pause", gapMs: gapMs > 0 ? gapMs : 100 });
      }
      if (kind === "Mouse") {
        const pointerType = s.kind === "Mouse" ? s.pointerType : HID_POINTER_TYPE.LeftClick;
        const pointerValue = (pointerType === HID_POINTER_TYPE.LeftClick || pointerType === HID_POINTER_TYPE.RightClick)
          ? 0
          : defaultMouseValue(pointerType);
        const gapMs = s.kind === "Mouse" && s.gapMs >= 0 ? s.gapMs : 0;
        return cloneStepWithId(s, { kind: "Mouse", pointerType: pointerType as HidPointerType, pointerValue, gapMs });
      }
      const gapMs = s.kind === "Function" && s.gapMs >= 0 ? s.gapMs : 0;
      const functionPointer = s.kind === "Function" ? (s.functionPointer || DEFAULT_FUNCTION_POINTER) : DEFAULT_FUNCTION_POINTER;
      const functionValue = FUNCTIONS_WITH_VALUE.has(functionPointer) && s.kind === "Function" && s.functionValue ? s.functionValue : 1;
      return cloneStepWithId(s, { kind: "Function", functionPointer, functionValue, gapMs });
    }));
    if (kind !== "Key" && capturingStepIndex != null && capturingStepIndex === index) {
      setCapturingStepIndex(null);
    }
  };

  const applyEdit = () => {
    if (!target) return;
    const mergedSteps: HidStepDto[] = (editSteps ?? []).map((step) => {
      if (step.kind === "Pause") {
        const gapMs = step.gapMs > 0 ? step.gapMs : 100;
        return { kind: "Pause", gapMs };
      }
      if (step.kind === "Function") {
        const functionValue = FUNCTIONS_WITH_VALUE.has(step.functionPointer) && step.functionValue && step.functionValue > 0 ? step.functionValue : 1;
        return { kind: "Function", functionPointer: step.functionPointer, functionValue, gapMs: step.gapMs >= 0 ? step.gapMs : 0 };
      }
      if (step.kind === "Mouse") {
        const gapMs = step.gapMs >= 0 ? step.gapMs : 0;
        const pointerValue = (step.pointerType === HID_POINTER_TYPE.LeftClick || step.pointerType === HID_POINTER_TYPE.RightClick)
          ? 0
          : defaultMouseValue(step.pointerType as HidPointerType);
        return { kind: "Mouse", pointerType: step.pointerType as HidPointerType, pointerValue, gapMs };
      }
      const keycode = step.keycode;
      const gapMs = step.gapMs > 0 ? step.gapMs : 10;
      const holdMs = step.holdMs > 0 ? step.holdMs : 10;
      return { kind: "Key", keycode, modifiers: step.modifiers, holdMs, gapMs };
    });

    const invalidKey = mergedSteps.find((s) => s.kind === "Key" && !KEY_OPTION_LOOKUP.has(s.keycode));
    if (invalidKey) {
      setLocalError("One or more keys are not valid HID keys. Pick from the list or recapture.");
      return;
    }

    if (mergedSteps.some((s) => s.kind === "Function" && !s.functionPointer)) {
      setLocalError("Select a function for all function steps.");
      return;
    }

    const nextBinding: HidBindingDto = { type: "Sequence", steps: mergedSteps };
    onSave(nextBinding);
    requestClose();
  };

  const requestClose = () => {
    if (!target) return;
    if (isClosingModal) return;
    setLocalError("");
    setIsClosingModal(true);
    resetModalClosePending();
    setCapturingStepIndex(null);
    setSelectedStepIndices([]);
    setDragOverIndex(null);
    setDraggingStepIndex(null);
    modalClosePendingRef.current = new Set(["modal-pop-out", "backdrop-fade-out"]);
  };

  const handleModalAnimationEnd = (animationName: string) => {
    if (!isClosingModal) return;
    if (!modalClosePendingRef.current.has(animationName)) return;
    modalClosePendingRef.current.delete(animationName);
    if (modalClosePendingRef.current.size === 0) {
      setIsClosingModal(false);
      resetModalClosePending();
      onClose();
    }
  };

  if (!target) return null;

  return (
    <div
      className={`modal-backdrop${isClosingModal ? " closing" : ""}`}
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
      onAnimationEnd={(e) => handleModalAnimationEnd(e.animationName)}
    >
      <div
        className={`modal step-modal${isClosingModal ? " closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={(e) => handleModalAnimationEnd(e.animationName)}
      >
        <div className="modal-header">
          <div className="modal-title">Edit {target.type === "button" ? `Button ${target.buttonId + 1}` : `Encoder ${target.encoderId + 1}`} bindings</div>
        </div>
        {target.type === "encoder" && (
          <div className="muted small">
            Input: {target.direction === "cw"
              ? "Clockwise"
              : target.direction === "ccw"
                ? "Counter-clockwise"
                : "Press"}
          </div>
        )}
        <div className="modal-body">
          {localError && (
            <div className="status-banner status-error local-error-banner" style={{ marginBottom: "0.75rem" }}>
              <div className="status-title small">{localError}</div>
            </div>
          )}
          <div className="steps-pane">
            <div className="step-controls">
              <div className="muted small">{selectedStepIndices.length > 0 ? `${selectedStepIndices.length} selected` : "Select or drag steps to move them. Copy/paste to duplicate."}</div>
              <div className="step-control-buttons">
                <button className="btn ghost" onClick={selectAllSteps} disabled={editSteps.length === 0}>Select all</button>
                <button className="btn ghost" onClick={clearSelectedSteps} disabled={selectedStepIndices.length === 0}>Clear selection</button>
                <button className="btn ghost" onClick={removeSelectedSteps} disabled={selectedStepIndices.length === 0}>Remove selected</button>
                <button
                  className="btn ghost"
                  onClick={copyStepsToClipboard}
                  disabled={selectedStepIndices.length === 0}
                >
                  Copy
                </button>
                <button className="btn ghost" onClick={pasteStepsFromClipboard}>Paste</button>
              </div>
            </div>
            <div className="steps-list steps-scroll" ref={stepsScrollRef}>
              {editSteps.length === 0 && <div className="muted small">No steps yet. Add a key, mouse action, function, or pause.</div>}
              {editSteps.map((step, idx) => {
                const stepKey = getStepId(step);
                const kind = step.kind;
                const selected = selectedStepIndices.includes(idx);
                const highlighted = highlightedSteps.includes(idx);
                const removing = removingStepIds.includes(stepKey);
                const inDragGroup = draggingStepIndex != null && (selected || draggingStepIndex === idx);
                const isFresh = freshSteps.includes(stepKey);
                const collapsed = activeStepIndex != null ? idx !== activeStepIndex : true;
                const collapsedPreview = collapsed ? describeStep(step) : "";
                const measuredHeight = stepHeights[stepKey];
                const bodyMaxHeight = collapsed
                  ? 0
                  : measuredHeight != null
                    ? `${measuredHeight}px`
                    : (isFresh ? "0px" : "1200px");
                const cardClasses = `step-card${selected ? " step-card-selected" : ""}${draggingStepIndex === idx ? " step-card-dragging" : ""}${dragOverIndex === idx ? " step-card-drop-target" : ""}${inDragGroup ? " step-card-drag-group" : ""}${highlighted ? " step-card-highlight" : ""}${removing ? " step-card-removing" : ""}${collapsed ? " step-card-collapsed" : ""}${isFresh ? " step-card-fresh" : ""}`;
                return (
                  <div
                    className={cardClasses}
                    key={`step-${stepKey}`}
                    draggable
                    ref={(el) => {
                      if (el) {
                        stepCardRefs.current.set(stepKey, el);
                      } else {
                        stepCardRefs.current.delete(stepKey);
                      }
                    }}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragLeave={() => { if (dragOverIndex === idx) setDragOverIndex(null); }}
                    onDragEnd={handleDragEnd}
                    onAnimationEnd={(e) => handleCardAnimationEnd(stepKey, e)}
                    aria-label={`Step ${idx + 1} ${kind}`}
                  >
                    <div className="step-header" onClick={(e) => { if (!isInteractiveElement(e.target)) toggleStepCollapse(idx); }}>
                      <div className="step-header-left">
                        <span className="drag-handle" title="Drag to reorder">::</span>
                        <label className="checkbox step-select">
                          <input
                            type="checkbox"
                            checked={selected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleStepSelection(idx)}
                          />
                          <span className="muted small">Select</span>
                        </label>
                        <div className="step-title">Step {idx + 1} · {kind === "Key" ? "Key" : kind === "Pause" ? "Pause" : kind === "Mouse" ? "Mouse" : "Function"}</div>
                        {collapsed && collapsedPreview && (
                          <span className="muted small step-preview" title={collapsedPreview}>{collapsedPreview}</span>
                        )}
                      </div>
                      <div className="step-header-actions">
                        <button className="btn ghost" onClick={(e) => { e.stopPropagation(); duplicateStep(idx); }}>Duplicate</button>
                        <button className="btn ghost" onClick={(e) => { e.stopPropagation(); removeStep(idx); }}>Remove</button>
                      </div>
                    </div>
                    <div
                      className={`step-body${collapsed ? " collapsed" : " expanded"}`}
                      ref={(el) => {
                        if (el) {
                          stepBodyRefs.current.set(stepKey, el);
                        } else {
                          stepBodyRefs.current.delete(stepKey);
                        }
                      }}
                      style={{ maxHeight: bodyMaxHeight }}
                    >
                      <div className="step-kind-toggle">
                        <button
                          className={`btn ghost${kind === "Key" ? " active" : ""}`}
                          onClick={(e) => { e.stopPropagation(); setStepKind(idx, "Key"); }}
                        >
                          Key
                        </button>
                        <button
                          className={`btn ghost${kind === "Pause" ? " active" : ""}`}
                          onClick={(e) => { e.stopPropagation(); setStepKind(idx, "Pause"); }}
                        >
                          Pause
                        </button>
                        <button
                          className={`btn ghost${kind === "Mouse" ? " active" : ""}`}
                          onClick={(e) => { e.stopPropagation(); setStepKind(idx, "Mouse"); }}
                        >
                          Mouse
                        </button>
                        <button
                          className={`btn ghost${kind === "Function" ? " active" : ""}`}
                          onClick={(e) => { e.stopPropagation(); setStepKind(idx, "Function"); }}
                        >
                          Function
                        </button>
                      </div>
                      {kind === "Pause" && (
                        <>
                          <div className="timing-row">
                            <label className="inline-input">
                              <span className="input-label">Pause (ms)</span>
                              <input
                                className="text-input"
                                type="number"
                                min={0}
                                value={step.gapMs}
                                onChange={(e) => updateStepTiming(idx, "gapMs", e.target.value)}
                              />
                            </label>
                          </div>
                          <div className="muted small pause-help">This pause waits before the next step.</div>
                        </>
                      )}
                      {kind === "Key" && (
                        <>
                          <div className="input-row">
                            <span className="input-label">Key</span>
                            <div className="key-row">
                              <label className="inline-input key-select">
                                <span className="input-label">Pick from list</span>
                                <select
                                  className="select-input"
                                  value={String(step.keycode ?? "")}
                                  onChange={(e) => {
                                    const parsed = Number(e.target.value);
                                    if (!Number.isFinite(parsed)) return;
                                    setEditSteps((prev) => prev.map((s, i) => {
                                      if (i !== idx || s.kind !== "Key") return s;
                                      const nextStep: HidStepDto = { ...s, keycode: parsed };
                                      return cloneStepWithId(s, nextStep);
                                    }));
                                  }}
                                >
                                  <option value="0">None (modifiers only)</option>
                                  <option value="">Select a key…</option>
                                  {KEY_OPTION_GROUPS.map((group) => (
                                    <optgroup key={group.label} label={group.label}>
                                      {group.options.map((opt) => (
                                        <option key={`${group.label}-${opt.value}`} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </optgroup>
                                  ))}
                                  {!KEY_OPTION_LOOKUP.has(step.keycode) && step.keycode !== 0 && (
                                    <option value={step.keycode}>Current: {keyLabelFromCode(step.keycode)}</option>
                                  )}
                                </select>
                              </label>
                              <div className="key-actions">
                                <button className={`btn ghost${capturingStepIndex === idx ? " active" : ""}`} onClick={() => setCapturingStepIndex(idx)}>
                                  {capturingStepIndex === idx ? "Capturing…" : "Capture from keyboard"}
                                </button>
                              </div>
                            </div>
                            <div className="checkbox-row tight">
                              {MODIFIER_BITS.map((m) => (
                                <label key={m.bit} className="checkbox">
                                  <input
                                    type="checkbox"
                                    checked={(step.modifiers & m.bit) !== 0}
                                    onChange={() => toggleStepModifier(idx, m.bit)}
                                  />
                                  {m.label}
                                </label>
                              ))}
                            </div>
                            {capturingStepIndex != null && capturingStepIndex !== idx && <div className="muted small">Finish current capture first.</div>}
                            {(() => {
                              const metaLabel = MODIFIER_BITS.find((m) => m.bit === 8)!.label;
                              return <div className="muted small">Capture reads the physical key and modifiers; {metaLabel} usually cannot be captured.</div>;
                            })()}
                          </div>
                          <div className="timing-row">
                            <label className="inline-input">
                              <span className="input-label">Hold (ms)</span>
                              <input
                                className="text-input"
                                type="number"
                                min={0}
                                value={step.holdMs}
                                onChange={(e) => updateStepTiming(idx, "holdMs", e.target.value)}
                              />
                            </label>
                            <label className="inline-input">
                              <span className="input-label">Gap after (ms)</span>
                              <input
                                className="text-input"
                                type="number"
                                min={0}
                                value={step.gapMs}
                                onChange={(e) => updateStepTiming(idx, "gapMs", e.target.value)}
                              />
                            </label>
                          </div>
                        </>
                      )}
                      {kind === "Mouse" && (
                        <>
                          <div className="input-row">
                            <span className="input-label">Mouse action</span>
                            <div className="grid two-col tight">
                              <label className="inline-input">
                                <span className="input-label">Type</span>
                                <select
                                  className="text-input"
                                  value={step.pointerType}
                                  onChange={(e) => {
                                    const nextType = Number(e.target.value) as HidPointerType;
                                    setEditSteps((prev) => prev.map((s, i) => {
                                      if (i !== idx || s.kind !== "Mouse") return s;
                                      const nextValue = nextType === HID_POINTER_TYPE.LeftClick || nextType === HID_POINTER_TYPE.RightClick
                                        ? 0
                                        : defaultMouseValue(nextType);
                                      const nextStep: HidStepDto = { ...s, pointerType: nextType, pointerValue: nextValue };
                                      return cloneStepWithId(s, nextStep);
                                    }));
                                  }}
                                >
                                  <option value={HID_POINTER_TYPE.MoveUp}>Move up</option>
                                  <option value={HID_POINTER_TYPE.MoveDown}>Move down</option>
                                  <option value={HID_POINTER_TYPE.MoveLeft}>Move left</option>
                                  <option value={HID_POINTER_TYPE.MoveRight}>Move right</option>
                                  <option value={HID_POINTER_TYPE.LeftClick}>Left click</option>
                                  <option value={HID_POINTER_TYPE.RightClick}>Right click</option>
                                  <option value={HID_POINTER_TYPE.ScrollUp}>Scroll up</option>
                                  <option value={HID_POINTER_TYPE.ScrollDown}>Scroll down</option>
                                </select>
                              </label>
                              <label className="inline-input">
                                <span className="input-label">Value</span>
                                <input
                                  className="text-input mouse-value-input"
                                  type="number"
                                  min={0}
                                  value={step.pointerType === HID_POINTER_TYPE.LeftClick || step.pointerType === HID_POINTER_TYPE.RightClick ? "" : step.pointerValue}
                                  onChange={(e) => setEditSteps((prev) => prev.map((s, i) => {
                                    if (i !== idx || s.kind !== "Mouse") return s;
                                    const nextStep: HidStepDto = { ...s, pointerValue: Number(e.target.value) };
                                    return cloneStepWithId(s, nextStep);
                                  }))}
                                  disabled={step.pointerType === HID_POINTER_TYPE.LeftClick || step.pointerType === HID_POINTER_TYPE.RightClick}
                                  placeholder={step.pointerType === HID_POINTER_TYPE.LeftClick || step.pointerType === HID_POINTER_TYPE.RightClick ? "N/A" : ""}
                                  title={step.pointerType === HID_POINTER_TYPE.LeftClick || step.pointerType === HID_POINTER_TYPE.RightClick ? "Value is ignored for click actions" : "Movement/scroll amount"}
                                />
                              </label>
                            </div>
                            {step.pointerType === HID_POINTER_TYPE.LeftClick || step.pointerType === HID_POINTER_TYPE.RightClick ? (
                              <div className="muted small mouse-help-spacer">Value: N/A for click actions.</div>
                            ) : (
                              <div className="muted small mouse-help-spacer">Value: pixels for moves; ticks for scroll.</div>
                            )}
                          </div>
                          <label className="inline-input">
                            <span className="input-label">Gap after (ms)</span>
                            <input
                              className="text-input"
                              type="number"
                              min={0}
                              value={step.gapMs}
                              onChange={(e) => updateStepTiming(idx, "gapMs", e.target.value)}
                            />
                          </label>
                          <div className="muted small">Clicks ignore value; moves/scrolls use it as pixels or ticks.</div>
                        </>
                      )}
                      {kind === "Function" && (
                        <>
                          <div className="input-row">
                            <span className="input-label">Function</span>
                            <div className="grid two-col tight">
                              <label className="inline-input">
                                <span className="input-label">Type</span>
                                <select
                                  className="text-input"
                                  value={step.functionPointer || DEFAULT_FUNCTION_POINTER}
                                  onChange={(e) => setEditSteps((prev) => prev.map((s, i) => {
                                    if (i !== idx || s.kind !== "Function") return s;
                                    const nextPointer = e.target.value || DEFAULT_FUNCTION_POINTER;
                                    const nextValue = FUNCTIONS_WITH_VALUE.has(nextPointer) ? (s.functionValue ?? 1) : 1;
                                    const nextStep: HidStepDto = { ...s, functionPointer: nextPointer, functionValue: nextValue };
                                    return cloneStepWithId(s, nextStep);
                                  }))}
                                >
                                  {Object.entries(FRIENDLY_FUNCTIONS).map(([fn, friendly]) => (
                                    <option key={fn} value={fn}>{friendly}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="inline-input">
                                <span className="input-label">Value</span>
                                <input
                                  className="text-input value-na-input"
                                  type="number"
                                  min={1}
                                  value={FUNCTIONS_WITH_VALUE.has(step.functionPointer || DEFAULT_FUNCTION_POINTER) ? step.functionValue ?? 1 : ""}
                                  onChange={(e) => updateFunctionValue(idx, e.target.value)}
                                  disabled={!FUNCTIONS_WITH_VALUE.has(step.functionPointer || DEFAULT_FUNCTION_POINTER)}
                                  placeholder={!FUNCTIONS_WITH_VALUE.has(step.functionPointer || DEFAULT_FUNCTION_POINTER) ? "N/A" : undefined}
                                />
                              </label>
                            </div>
                            {!FUNCTIONS_WITH_VALUE.has(step.functionPointer || DEFAULT_FUNCTION_POINTER) ? (
                              <div className="muted small mouse-help-spacer">Value: N/A for this function.</div>
                            ) : (
                              <div className="muted small mouse-help-spacer">Value: repeat count for volume steps.</div>
                            )}
                          </div>
                          <label className="inline-input gap-spacer">
                            <span className="input-label">Gap after (ms)</span>
                            <input
                              className="text-input"
                              type="number"
                              min={0}
                              value={step.gapMs}
                              onChange={(e) => updateStepTiming(idx, "gapMs", e.target.value)}
                            />
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="step-actions">
              <button className="btn" onClick={addKeyStep}>Add key</button>
              <button className="btn" onClick={addDelayStep}>Add pause</button>
              <button className="btn" onClick={() => setEditSteps((prev) => [...prev, { kind: "Mouse", pointerType: 4, pointerValue: 0, gapMs: 0 }])}>Add mouse</button>
              <button className="btn" onClick={addFunctionStep}>Add function</button>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={requestClose}>Cancel</button>
          <button className="btn btn-primary" onClick={applyEdit} disabled={editSteps.some((s) => s.kind === "Function" && !s.functionPointer)}>Save</button>
        </div>
        <input
          ref={hiddenKeyInputRef}
          type="text"
          inputMode="text"
          className="hidden-key-input"
          aria-hidden="true"
          tabIndex={-1}
          onBlur={() => setCapturingStepIndex((prev) => (prev != null ? null : prev))}
        />
      </div>
    </div>
  );
}
