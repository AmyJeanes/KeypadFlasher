import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LayoutPreview } from "./LayoutPreview";
import type { HidBindingDto } from "../lib/keypadConfigs";
import { sampleBindings, sampleLayout, sampleLedConfig } from "../test/fixtures";

function bindingMaps() {
  const buttonBindings = new Map<number, HidBindingDto>();
  sampleBindings.buttons.forEach((entry) => buttonBindings.set(entry.id, entry.binding));

  const encoderBindings = new Map<number, { clockwise: HidBindingDto; counterClockwise: HidBindingDto; press?: HidBindingDto }>();
  sampleBindings.encoders.forEach((entry) => {
    encoderBindings.set(entry.id, {
      clockwise: entry.clockwise,
      counterClockwise: entry.counterClockwise,
      press: entry.press,
    });
  });

  return { buttonBindings, encoderBindings };
}

describe("LayoutPreview", () => {
  it("routes button Bindings action to onEdit", () => {
    const onEdit = vi.fn();
    const { buttonBindings, encoderBindings } = bindingMaps();

    render(
      <LayoutPreview
        layout={sampleLayout}
        layoutRows={[2]}
        buttonBindings={buttonBindings}
        encoderBindings={encoderBindings}
        ledConfig={sampleLedConfig}
        warnNoBootEntry={false}
        warnSingleChord={false}
        onEdit={onEdit}
        onOpenLightingForLed={vi.fn()}
        onToggleBootloaderOnBoot={vi.fn()}
        onToggleBootloaderChord={vi.fn()}
      />,
    );

    const buttonOneTile = screen.getByText("Button 1").closest(".button-tile");
    expect(buttonOneTile).toBeTruthy();
    const bindingsButton = within(buttonOneTile as HTMLElement).getByRole("button", { name: "Bindings" });
    fireEvent.click(bindingsButton);
    fireEvent.click(bindingsButton);
    expect(onEdit).toHaveBeenCalledWith({ type: "button", buttonId: 0 });
  });

  it("toggles button bootloader flags through callbacks", () => {
    const onToggleBootloaderOnBoot = vi.fn();
    const onToggleBootloaderChord = vi.fn();
    const { buttonBindings, encoderBindings } = bindingMaps();

    render(
      <LayoutPreview
        layout={sampleLayout}
        layoutRows={[2]}
        buttonBindings={buttonBindings}
        encoderBindings={encoderBindings}
        ledConfig={sampleLedConfig}
        warnNoBootEntry={false}
        warnSingleChord={false}
        onEdit={vi.fn()}
        onOpenLightingForLed={vi.fn()}
        onToggleBootloaderOnBoot={onToggleBootloaderOnBoot}
        onToggleBootloaderChord={onToggleBootloaderChord}
      />,
    );

    const buttonOneTile = screen.getByText("Button 1").closest(".button-tile");
    expect(buttonOneTile).toBeTruthy();
    fireEvent.click(within(buttonOneTile as HTMLElement).getByTitle("Toggle bootloader on boot"));
    fireEvent.click(within(buttonOneTile as HTMLElement).getByTitle("Toggle bootloader chord membership"));

    expect(onToggleBootloaderOnBoot).toHaveBeenCalledWith({ type: "button", buttonId: 0 }, false);
    expect(onToggleBootloaderChord).toHaveBeenCalledWith({ type: "button", buttonId: 0 }, true);
  });

  it("routes Lighting action to onOpenLightingForLed for LED-mapped buttons", () => {
    const onOpenLightingForLed = vi.fn();
    const { buttonBindings, encoderBindings } = bindingMaps();

    render(
      <LayoutPreview
        layout={sampleLayout}
        layoutRows={[2]}
        buttonBindings={buttonBindings}
        encoderBindings={encoderBindings}
        ledConfig={sampleLedConfig}
        warnNoBootEntry={false}
        warnSingleChord={false}
        onEdit={vi.fn()}
        onOpenLightingForLed={onOpenLightingForLed}
        onToggleBootloaderOnBoot={vi.fn()}
        onToggleBootloaderChord={vi.fn()}
      />,
    );

    const buttonOneTile = screen.getByText("Button 1").closest(".button-tile");
    expect(buttonOneTile).toBeTruthy();
    const lightingButton = within(buttonOneTile as HTMLElement).getByRole("button", { name: "Lighting" });
    fireEvent.click(lightingButton);
    fireEvent.click(lightingButton);
    expect(onOpenLightingForLed).toHaveBeenCalledWith(0);
  });

  it("disables lighting action for buttons with no LED", () => {
    const layoutNoLed = {
      ...sampleLayout,
      buttons: [{ ...sampleLayout.buttons[0], ledIndex: -1 }],
      encoders: [],
    };

    const buttonBindings = new Map<number, HidBindingDto>([[0, sampleBindings.buttons[0].binding]]);
    const encoderBindings = new Map<number, { clockwise: HidBindingDto; counterClockwise: HidBindingDto; press?: HidBindingDto }>();

    render(
      <LayoutPreview
        layout={layoutNoLed}
        layoutRows={[1]}
        buttonBindings={buttonBindings}
        encoderBindings={encoderBindings}
        ledConfig={sampleLedConfig}
        warnNoBootEntry={false}
        warnSingleChord={false}
        onEdit={vi.fn()}
        onOpenLightingForLed={vi.fn()}
        onToggleBootloaderOnBoot={vi.fn()}
        onToggleBootloaderChord={vi.fn()}
      />,
    );

    const noLedButton = screen.getByRole("button", { name: "No LED" }) as HTMLButtonElement;
    expect(noLedButton.disabled).toBe(true);
  });

  it("routes encoder press Bindings action to onEdit", () => {
    const onEdit = vi.fn();
    const { buttonBindings, encoderBindings } = bindingMaps();

    render(
      <LayoutPreview
        layout={sampleLayout}
        layoutRows={[2]}
        buttonBindings={buttonBindings}
        encoderBindings={encoderBindings}
        ledConfig={sampleLedConfig}
        warnNoBootEntry={false}
        warnSingleChord={false}
        onEdit={onEdit}
        onOpenLightingForLed={vi.fn()}
        onToggleBootloaderOnBoot={vi.fn()}
        onToggleBootloaderChord={vi.fn()}
      />,
    );

    const encoderTile = screen.getByText("Encoder 1").closest(".encoder-tile");
    expect(encoderTile).toBeTruthy();
    const bindingButtons = within(encoderTile as HTMLElement).getAllByRole("button", { name: "Bindings" });
    fireEvent.click(bindingButtons[2]);
    fireEvent.click(bindingButtons[2]);

    expect(onEdit).toHaveBeenCalledWith({ type: "encoder", encoderId: 0, direction: "press" });
  });
});
