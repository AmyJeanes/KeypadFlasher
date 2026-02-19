export type EditTarget =
  | { type: "button"; buttonId: number }
  | { type: "encoder"; encoderId: number; direction: "ccw" | "cw" | "press" };

export type PassiveLedMode = "Off" | "Rainbow" | "Static" | "Breathing";
export type ActiveLedMode = "Off" | "Nothing" | "Solid";

export type LedColor = { r: number; g: number; b: number };

export type LedPerKeyDto = {
  passiveMode: PassiveLedMode;
  passiveColor: LedColor;
  activeMode: ActiveLedMode;
  activeColor: LedColor;
  rainbowStepMs: number;
  breathingMinPercent: number;
  breathingStepMs: number;
};

export type LedConfigurationDto = {
  leds: LedPerKeyDto[];
  brightnessPercent: number;
};

export type StatusState =
  | "idle"
  | "requesting"
  | "connectedKnown"
  | "connectedUnknown"
  | "compiling"
  | "unsupported"
  | "flashing"
  | "flashDone"
  | "compileError"
  | "flashError"
  | "fileApiMissing"
  | "needConnect"
  | "deviceLost"
  | "error";

export type Status = { state: StatusState; detail?: string };
