import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import { useBindingsEditor } from "./useBindingsEditor";
import type { HidBindingDto } from "../lib/keypadConfigs";
import type { BindingProfileDto, DeviceLayoutDto } from "../lib/keypadConfigs";
import { sampleBindings, sampleLayout } from "../test/fixtures";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("useBindingsEditor", () => {
  it("opens editor with the existing binding for an encoder direction", () => {
    const { result } = renderHook(() => {
      const [currentBindings, setCurrentBindings] = useState<BindingProfileDto | null>(clone(sampleBindings));
      const [selectedLayout, setSelectedLayout] = useState<DeviceLayoutDto | null>(clone(sampleLayout));
      const hook = useBindingsEditor({ currentBindings, setCurrentBindings, setSelectedLayout });
      return { ...hook, selectedLayout, currentBindings };
    });

    act(() => {
      result.current.openEdit({ type: "encoder", encoderId: 0, direction: "press" });
    });

    expect(result.current.editorTarget).toEqual({ type: "encoder", encoderId: 0, direction: "press" });
    expect(result.current.editorBinding).toEqual(sampleBindings.encoders[0].press);
  });

  it("saves a button binding and keeps button ids sorted", () => {
    const initialBindings = clone(sampleBindings);
    initialBindings.buttons = [initialBindings.buttons[1], initialBindings.buttons[0]];

    const { result } = renderHook(() => {
      const [currentBindings, setCurrentBindings] = useState<BindingProfileDto | null>(initialBindings);
      const [selectedLayout, setSelectedLayout] = useState<DeviceLayoutDto | null>(clone(sampleLayout));
      const hook = useBindingsEditor({ currentBindings, setCurrentBindings, setSelectedLayout });
      return { ...hook, selectedLayout, currentBindings };
    });

    const replacement: HidBindingDto = { type: "Sequence", steps: [{ kind: "Pause", gapMs: 250 }] };

    act(() => {
      result.current.openEdit({ type: "button", buttonId: 1 });
    });

    act(() => {
      result.current.handleEditorSave(replacement);
    });

    expect(result.current.currentBindings?.buttons.map((b) => b.id)).toEqual([0, 1]);
    expect(result.current.currentBindings?.buttons.find((b) => b.id === 1)?.binding).toEqual(replacement);
  });

  it("updates bootloader flags for button and encoder press", () => {
    const { result } = renderHook(() => {
      const [currentBindings, setCurrentBindings] = useState<BindingProfileDto | null>(clone(sampleBindings));
      const [selectedLayout, setSelectedLayout] = useState<DeviceLayoutDto | null>(clone(sampleLayout));
      const hook = useBindingsEditor({ currentBindings, setCurrentBindings, setSelectedLayout });
      return { ...hook, selectedLayout, currentBindings };
    });

    act(() => {
      result.current.updateBootloaderOnBoot({ type: "button", buttonId: 1 }, true);
      result.current.updateBootloaderChordMember({ type: "encoder", encoderId: 0, direction: "press" }, true);
    });

    expect(result.current.selectedLayout?.buttons.find((b) => b.id === 1)?.bootloaderOnBoot).toBe(true);
    expect(result.current.selectedLayout?.encoders[0].press?.bootloaderChordMember).toBe(true);
  });
});
