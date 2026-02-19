import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { StepEditor } from "./StepEditor";
import type { HidBindingDto } from "../lib/keypadConfigs";

function makeProps(overrides: Partial<ComponentProps<typeof StepEditor>> = {}): ComponentProps<typeof StepEditor> {
  return {
    target: { type: "button", buttonId: 0 },
    binding: { type: "Sequence", steps: [] },
    stepClipboard: null,
    onSave: vi.fn(),
    onClose: vi.fn(),
    onUpdateStepClipboard: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
}

describe("StepEditor", () => {
  beforeAll(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("adds a key step and saves normalized sequence", () => {
    const onSave = vi.fn();
    render(<StepEditor {...makeProps({ onSave })} />);

    fireEvent.click(screen.getByRole("button", { name: "Add key" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as HidBindingDto;
    expect(saved.type).toBe("Sequence");
    expect(saved.steps).toHaveLength(1);
    expect(saved.steps[0]).toMatchObject({ kind: "Key", keycode: 97, modifiers: 0, holdMs: 10, gapMs: 10 });
  });

  it("shows an error when paste is requested without clipboard data", () => {
    render(<StepEditor {...makeProps({ stepClipboard: null })} />);

    fireEvent.click(screen.getByRole("button", { name: "Paste" }));

    expect(screen.getByText(/Nothing to paste yet/i)).toBeTruthy();
  });

  it("captures keyboard input into a key step", () => {
    const onSave = vi.fn();
    render(<StepEditor {...makeProps({ onSave })} />);

    fireEvent.click(screen.getByRole("button", { name: "Add key" }));
    fireEvent.click(screen.getByRole("button", { name: "Capture from keyboard" }));
    fireEvent.keyDown(window, { code: "KeyB", key: "b", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const saved = onSave.mock.calls[0][0] as HidBindingDto;
    expect(saved.steps[0]).toMatchObject({ kind: "Key", keycode: 98, modifiers: 0 });
  });
});
