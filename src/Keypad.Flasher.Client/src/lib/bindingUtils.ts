import type { HidBindingDto, HidPointerType, HidStepDto } from "./keypadConfigs";
import { HID_POINTER_TYPE } from "./keypadConfigs";

export const FRIENDLY_FUNCTIONS: Record<string, string> = {
  hid_consumer_volume_up: "Volume Up",
  hid_consumer_volume_down: "Volume Down",
  hid_consumer_mute: "Volume Mute",
  hid_consumer_media_play_pause: "Play/Pause",
  hid_consumer_media_next: "Next Track",
  hid_consumer_media_previous: "Previous Track",
  hid_consumer_media_stop: "Stop",
};

export const FUNCTIONS_WITH_VALUE = new Set(["hid_consumer_volume_up", "hid_consumer_volume_down"]);

export const DEFAULT_FUNCTION_POINTER = Object.keys(FRIENDLY_FUNCTIONS)[0] ?? "";

const isMacLike = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform || "");
const metaLabel = isMacLike ? "Cmd" : "Win";

export const MODIFIER_BITS = [
  { bit: 1, label: "Ctrl" },
  { bit: 2, label: "Shift" },
  { bit: 4, label: "Alt" },
  { bit: 8, label: metaLabel },
];

const CODE_TO_KEYCODE: Record<string, number> = {
  KeyA: "a".charCodeAt(0),
  KeyB: "b".charCodeAt(0),
  KeyC: "c".charCodeAt(0),
  KeyD: "d".charCodeAt(0),
  KeyE: "e".charCodeAt(0),
  KeyF: "f".charCodeAt(0),
  KeyG: "g".charCodeAt(0),
  KeyH: "h".charCodeAt(0),
  KeyI: "i".charCodeAt(0),
  KeyJ: "j".charCodeAt(0),
  KeyK: "k".charCodeAt(0),
  KeyL: "l".charCodeAt(0),
  KeyM: "m".charCodeAt(0),
  KeyN: "n".charCodeAt(0),
  KeyO: "o".charCodeAt(0),
  KeyP: "p".charCodeAt(0),
  KeyQ: "q".charCodeAt(0),
  KeyR: "r".charCodeAt(0),
  KeyS: "s".charCodeAt(0),
  KeyT: "t".charCodeAt(0),
  KeyU: "u".charCodeAt(0),
  KeyV: "v".charCodeAt(0),
  KeyW: "w".charCodeAt(0),
  KeyX: "x".charCodeAt(0),
  KeyY: "y".charCodeAt(0),
  KeyZ: "z".charCodeAt(0),
  Digit1: "1".charCodeAt(0),
  Digit2: "2".charCodeAt(0),
  Digit3: "3".charCodeAt(0),
  Digit4: "4".charCodeAt(0),
  Digit5: "5".charCodeAt(0),
  Digit6: "6".charCodeAt(0),
  Digit7: "7".charCodeAt(0),
  Digit8: "8".charCodeAt(0),
  Digit9: "9".charCodeAt(0),
  Digit0: "0".charCodeAt(0),
  Minus: "-".charCodeAt(0),
  Equal: "=".charCodeAt(0),
  BracketLeft: "[".charCodeAt(0),
  BracketRight: "]".charCodeAt(0),
  Backslash: "\\".charCodeAt(0),
  Semicolon: ";".charCodeAt(0),
  Quote: "'".charCodeAt(0),
  Backquote: "`".charCodeAt(0),
  Comma: ",".charCodeAt(0),
  Period: ".".charCodeAt(0),
  Slash: "/".charCodeAt(0),
  Space: " ".charCodeAt(0),
  Enter: 0xb0,
  NumpadEnter: 0xb0,
  Tab: 0xb3,
  Backspace: 0xb2,
  Escape: 0xb1,
  Delete: 0xd4,
  Insert: 0xd1,
  Home: 0xd2,
  End: 0xd5,
  PageUp: 0xd3,
  PageDown: 0xd6,
  ArrowUp: 0xda,
  ArrowDown: 0xd9,
  ArrowLeft: 0xd8,
  ArrowRight: 0xd7,
  CapsLock: 0xc1,
};

type KeyOption = { value: number; label: string };
type KeyOptionGroup = { label: string; options: KeyOption[] };

const LETTER_KEYS: KeyOption[] = "abcdefghijklmnopqrstuvwxyz".split("").map((ch) => ({ value: ch.charCodeAt(0), label: ch.toUpperCase() }));
const NUMBER_KEYS: KeyOption[] = "0123456789".split("").map((ch) => ({ value: ch.charCodeAt(0), label: ch }));
const SYMBOL_KEYS: KeyOption[] = [
  { value: " ".charCodeAt(0), label: "Space" },
  { value: "-".charCodeAt(0), label: "-" },
  { value: "=".charCodeAt(0), label: "=" },
  { value: "[".charCodeAt(0), label: "[" },
  { value: "]".charCodeAt(0), label: "]" },
  { value: "\\".charCodeAt(0), label: "\\" },
  { value: ";".charCodeAt(0), label: ";" },
  { value: "'".charCodeAt(0), label: "'" },
  { value: "`".charCodeAt(0), label: "`" },
  { value: ",".charCodeAt(0), label: "," },
  { value: ".".charCodeAt(0), label: "." },
  { value: "/".charCodeAt(0), label: "/" },
];

const NAV_KEYS: KeyOption[] = [
  { value: 0xb0, label: "Enter" },
  { value: 0xb1, label: "Escape" },
  { value: 0xb2, label: "Backspace" },
  { value: 0xb3, label: "Tab" },
  { value: 0xc1, label: "Caps Lock" },
  { value: 0xd1, label: "Insert" },
  { value: 0xd4, label: "Delete" },
  { value: 0xd2, label: "Home" },
  { value: 0xd5, label: "End" },
  { value: 0xd3, label: "Page Up" },
  { value: 0xd6, label: "Page Down" },
  { value: 0xd7, label: "Arrow Right" },
  { value: 0xd8, label: "Arrow Left" },
  { value: 0xd9, label: "Arrow Down" },
  { value: 0xda, label: "Arrow Up" },
];

const FUNCTION_KEYS: KeyOption[] = [
  ...Array.from({ length: 12 }, (_, idx) => ({ value: 0xc2 + idx, label: `F${idx + 1}` })),
  ...Array.from({ length: 12 }, (_, idx) => ({ value: 0xf0 + idx, label: `F${idx + 13}` })),
];

export const KEY_OPTION_GROUPS: KeyOptionGroup[] = [
  { label: "Letters", options: LETTER_KEYS },
  { label: "Numbers", options: NUMBER_KEYS },
  { label: "Symbols", options: SYMBOL_KEYS },
  { label: "Navigation", options: NAV_KEYS },
  { label: "Function keys", options: FUNCTION_KEYS },
];

export const KEY_OPTION_LOOKUP = new Map<number, KeyOption>();
KEY_OPTION_LOOKUP.set(0, { value: 0, label: "None (modifiers only)" });
KEY_OPTION_GROUPS.forEach((group) => group.options.forEach((opt) => {
  if (!KEY_OPTION_LOOKUP.has(opt.value)) {
    KEY_OPTION_LOOKUP.set(opt.value, opt);
  }
}));

export const keyLabelFromCode = (code: number): string => {
  if (!code) return "";
  const opt = KEY_OPTION_LOOKUP.get(code);
  if (opt) return opt.label;
  if (code >= 32 && code <= 126) return String.fromCharCode(code).toUpperCase();
  return `Key ${code}`;
};

export const captureKeyboardEventToKey = (event: KeyboardEvent): { keycode: number; modifiers: number } | null => {
  const codeKey = CODE_TO_KEYCODE[event.code];
  if (codeKey == null) return null;

  const altGraph = typeof event.getModifierState === "function" && event.getModifierState("AltGraph");
  const ctrl = Boolean(event.ctrlKey || altGraph);
  const shift = Boolean(event.shiftKey);
  const alt = Boolean(event.altKey || altGraph);
  const meta = Boolean(event.metaKey);

  let modifiers = 0;
  if (ctrl) modifiers |= 1;
  if (shift) modifiers |= 2;
  if (alt) modifiers |= 4;
  if (meta) modifiers |= 8;
  return { keycode: codeKey, modifiers };
};

export const describeStep = (step: HidStepDto): string => {
  if (step.kind === "Pause") {
    const pauseMs = step.gapMs > 0 ? step.gapMs : 0;
    return pauseMs > 0 ? `Pause ${pauseMs}ms` : "Pause";
  }
  if (step.kind === "Function") {
    const friendly = FRIENDLY_FUNCTIONS[step.functionPointer];
    return friendly || step.functionPointer || "(unset)";
  }
  if (step.kind === "Mouse") {
    switch (step.pointerType) {
      case HID_POINTER_TYPE.MoveUp: return `Mouse up ${step.pointerValue}`;
      case HID_POINTER_TYPE.MoveDown: return `Mouse down ${step.pointerValue}`;
      case HID_POINTER_TYPE.MoveLeft: return `Mouse left ${step.pointerValue}`;
      case HID_POINTER_TYPE.MoveRight: return `Mouse right ${step.pointerValue}`;
      case HID_POINTER_TYPE.LeftClick: return "Mouse left click";
      case HID_POINTER_TYPE.RightClick: return "Mouse right click";
      case HID_POINTER_TYPE.ScrollUp: return `Scroll up ${step.pointerValue}`;
      case HID_POINTER_TYPE.ScrollDown: return `Scroll down ${step.pointerValue}`;
      default: return "Mouse action";
    }
  }
  const mods = MODIFIER_BITS.filter((m) => (step.modifiers & m.bit) !== 0).map((m) => m.label);
  const keyLabel = keyLabelFromCode(step.keycode);
  if (mods.length > 0 && keyLabel) return `${mods.join("+")}+${keyLabel}`;
  if (mods.length > 0 && !keyLabel) return mods.join("+");
  return keyLabel || "(unset)";
};

export const defaultMouseValue = (pointerType: HidPointerType): number => {
  if (pointerType === HID_POINTER_TYPE.MoveUp || pointerType === HID_POINTER_TYPE.MoveDown || pointerType === HID_POINTER_TYPE.MoveLeft || pointerType === HID_POINTER_TYPE.MoveRight) return 100;
  if (pointerType === HID_POINTER_TYPE.ScrollUp || pointerType === HID_POINTER_TYPE.ScrollDown) return 1;
  return 0;
};

const requireNumber = (value: unknown, label: string): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error(`${label} must be a number.`);
};

export const normalizeIncomingStep = (step: unknown): HidStepDto => {
  if (!step || typeof step !== "object") {
    throw new Error("Step must be an object.");
  }

  const candidate = step as {
    kind?: unknown;
    keycode?: unknown;
    modifiers?: unknown;
    holdMs?: unknown;
    gapMs?: unknown;
    pointerType?: unknown;
    pointerValue?: unknown;
    functionPointer?: unknown;
    functionValue?: unknown;
  };

  switch (candidate.kind) {
    case "Key": {
      const modifiers = requireNumber(candidate.modifiers ?? 0, "Key modifiers");
      const rawKeycode = requireNumber(candidate.keycode ?? 0, "Key keycode");
      const keycode = rawKeycode === 0 && modifiers === 0 ? 97 : rawKeycode;
      const holdMs = requireNumber(candidate.holdMs ?? 10, "Key holdMs");
      const gapMs = requireNumber(candidate.gapMs ?? 10, "Key gapMs");
      return { kind: "Key", keycode, modifiers, holdMs, gapMs };
    }
    case "Pause": {
      const gapMs = requireNumber(candidate.gapMs ?? 100, "Pause gapMs");
      return { kind: "Pause", gapMs: gapMs > 0 ? gapMs : 100 };
    }
    case "Mouse": {
      const pointerType = requireNumber(candidate.pointerType ?? HID_POINTER_TYPE.LeftClick, "Mouse pointerType") as HidPointerType;
      const rawValue = typeof candidate.pointerValue === "number" ? candidate.pointerValue : defaultMouseValue(pointerType);
      const pointerValue = (pointerType === HID_POINTER_TYPE.LeftClick || pointerType === HID_POINTER_TYPE.RightClick)
        ? 0
        : (rawValue === 0 ? defaultMouseValue(pointerType) : rawValue);
      const gapMs = requireNumber(candidate.gapMs ?? 0, "Mouse gapMs");
      return { kind: "Mouse", pointerType, pointerValue, gapMs: gapMs >= 0 ? gapMs : 0 };
    }
    case "Function": {
      const functionPointer = typeof candidate.functionPointer === "string" && candidate.functionPointer
        ? candidate.functionPointer
        : DEFAULT_FUNCTION_POINTER;
      const gapMs = requireNumber(candidate.gapMs ?? 0, "Function gapMs");
      const functionValue = requireNumber(candidate.functionValue ?? 1, "Function functionValue");
      return { kind: "Function", functionPointer, gapMs, functionValue };
    }
    default:
      throw new Error("Unsupported step kind.");
  }
};

export const describeBinding = (binding: HidBindingDto | undefined | null): string => {
  if (!binding || binding.type !== "Sequence") return "Unassigned";
  if (!binding.steps || binding.steps.length === 0) return "(empty)";
  return binding.steps.map((s) => describeStep(s)).join(", ");
};
