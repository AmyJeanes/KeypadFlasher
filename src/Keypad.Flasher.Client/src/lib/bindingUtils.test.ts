import { describe, expect, it } from "vitest";
import {
  HID_POINTER_TYPE,
  type HidStepDto,
} from "./keypadConfigs";
import {
  captureKeyboardEventToKey,
  defaultMouseValue,
  describeBinding,
  describeStep,
  keyLabelFromCode,
  normalizeIncomingStep,
} from "./bindingUtils";

describe("bindingUtils", () => {
  it("captures keyboard event keycode and modifier bitmask", () => {
    const event = {
      code: "KeyA",
      ctrlKey: true,
      shiftKey: false,
      altKey: true,
      metaKey: false,
      getModifierState: () => false,
    } as unknown as KeyboardEvent;

    const captured = captureKeyboardEventToKey(event);
    expect(captured).toEqual({ keycode: 97, modifiers: 5 });
  });

  it("returns null for unknown keyboard codes", () => {
    const event = {
      code: "F24",
      getModifierState: () => false,
    } as unknown as KeyboardEvent;

    expect(captureKeyboardEventToKey(event)).toBeNull();
  });

  it("normalizes key and pause steps with sensible defaults", () => {
    expect(normalizeIncomingStep({ kind: "Key", keycode: 0, modifiers: 0 })).toMatchObject({
      kind: "Key",
      keycode: 97,
      holdMs: 10,
      gapMs: 10,
    });

    expect(normalizeIncomingStep({ kind: "Pause", gapMs: 0 })).toEqual({ kind: "Pause", gapMs: 100 });
  });

  it("normalizes mouse and function steps", () => {
    expect(normalizeIncomingStep({ kind: "Mouse", pointerType: HID_POINTER_TYPE.LeftClick, pointerValue: 99, gapMs: -1 })).toEqual({
      kind: "Mouse",
      pointerType: HID_POINTER_TYPE.LeftClick,
      pointerValue: 0,
      gapMs: 0,
    });

    expect(normalizeIncomingStep({ kind: "Function", functionPointer: "", functionValue: 0, gapMs: 2 })).toMatchObject({
      kind: "Function",
      functionValue: 0,
      gapMs: 2,
    });
  });

  it("formats descriptions for key, mouse, function and pause steps", () => {
    const steps: HidStepDto[] = [
      { kind: "Key", keycode: 97, modifiers: 1, holdMs: 10, gapMs: 10 },
      { kind: "Mouse", pointerType: HID_POINTER_TYPE.MoveRight, pointerValue: 10, gapMs: 0 },
      { kind: "Function", functionPointer: "hid_consumer_media_play_pause", gapMs: 0, functionValue: 1 },
      { kind: "Pause", gapMs: 50 },
    ];

    expect(describeStep(steps[0])).toContain("A");
    expect(describeStep(steps[1])).toBe("Mouse right 10");
    expect(describeStep(steps[2])).toBe("Play/Pause");
    expect(describeStep(steps[3])).toBe("Pause 50ms");
  });

  it("returns key labels and fallback labels correctly", () => {
    expect(keyLabelFromCode(97)).toBe("A");
    expect(keyLabelFromCode(0)).toBe("");
    expect(keyLabelFromCode(500)).toBe("Key 500");
  });

  it("handles binding descriptions and default mouse movement values", () => {
    expect(defaultMouseValue(HID_POINTER_TYPE.MoveUp)).toBe(100);
    expect(defaultMouseValue(HID_POINTER_TYPE.ScrollDown)).toBe(1);
    expect(defaultMouseValue(HID_POINTER_TYPE.LeftClick)).toBe(0);

    expect(describeBinding(null)).toBe("Unassigned");
    expect(describeBinding({ type: "Sequence", steps: [] })).toBe("(empty)");
  });
});
