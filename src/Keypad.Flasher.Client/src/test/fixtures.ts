import type { BindingProfileDto, DeviceLayoutDto } from "../lib/keypadConfigs";
import type { LedConfigurationDto } from "../types";

export const sampleLayout: DeviceLayoutDto = {
  buttons: [
    { id: 0, pin: 14, activeLow: true, ledIndex: 0, bootloaderOnBoot: true, bootloaderChordMember: false },
    { id: 1, pin: 15, activeLow: true, ledIndex: 1, bootloaderOnBoot: false, bootloaderChordMember: true },
  ],
  encoders: [
    {
      id: 0,
      pinA: 30,
      pinB: 31,
      press: { pin: 33, activeLow: true, bootloaderOnBoot: false, bootloaderChordMember: false },
    },
  ],
  neoPixelPin: 34,
  neoPixelReversed: false,
  displayRows: [2],
};

export const sampleBindings: BindingProfileDto = {
  buttons: [
    { id: 0, binding: { type: "Sequence", steps: [{ kind: "Key", keycode: 97, modifiers: 0, holdMs: 10, gapMs: 10 }] } },
    { id: 1, binding: { type: "Sequence", steps: [{ kind: "Pause", gapMs: 120 }] } },
  ],
  encoders: [
    {
      id: 0,
      clockwise: { type: "Sequence", steps: [{ kind: "Function", functionPointer: "hid_consumer_volume_up", functionValue: 1, gapMs: 0 }] },
      counterClockwise: { type: "Sequence", steps: [{ kind: "Function", functionPointer: "hid_consumer_volume_down", functionValue: 1, gapMs: 0 }] },
      press: { type: "Sequence", steps: [{ kind: "Mouse", pointerType: 4, pointerValue: 0, gapMs: 0 }] },
    },
  ],
};

export const sampleLedConfig: LedConfigurationDto = {
  brightnessPercent: 80,
  leds: [
    {
      passiveMode: "Rainbow",
      passiveColor: { r: 255, g: 0, b: 0 },
      activeMode: "Solid",
      activeColor: { r: 255, g: 255, b: 255 },
      rainbowStepMs: 20,
      breathingMinPercent: 20,
      breathingStepMs: 20,
    },
    {
      passiveMode: "Static",
      passiveColor: { r: 0, g: 255, b: 0 },
      activeMode: "Off",
      activeColor: { r: 0, g: 0, b: 0 },
      rainbowStepMs: 20,
      breathingMinPercent: 20,
      breathingStepMs: 20,
    },
  ],
};
