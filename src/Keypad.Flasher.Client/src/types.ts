export type EditTarget =
  | { type: "button"; buttonId: number }
  | { type: "encoder"; encoderId: number; direction: "ccw" | "cw" | "press" };

export type PassiveLedMode = "Off" | "Rainbow" | "Static" | "Breathing";
export type ActiveLedMode = "Off" | "Nothing" | "Solid";

export type LedColor = { r: number; g: number; b: number };

export type LedConfigurationDto = {
  passiveModes: PassiveLedMode[];
  passiveColors: LedColor[];
  activeModes: ActiveLedMode[];
  activeColors: LedColor[];
  brightnessPercent: number;
  rainbowStepMs: number;
  breathingMinPercent: number;
  breathingStepMs: number;
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
