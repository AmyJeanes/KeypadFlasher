export const HID_POINTER_TYPE = {
  MoveUp: 0,
  MoveDown: 1,
  MoveLeft: 2,
  MoveRight: 3,
  LeftClick: 4,
  RightClick: 5,
  ScrollUp: 6,
  ScrollDown: 7,
} as const;

export type HidPointerType = (typeof HID_POINTER_TYPE)[keyof typeof HID_POINTER_TYPE];

export type HidStepDto =
  | {
      kind: "Key";
      keycode: number;
      modifiers: number; // bitmask: 1=Ctrl, 2=Shift, 4=Alt, 8=GUI
      holdMs: number;
      gapMs: number;
      pointerType?: HidPointerType;
      pointerValue?: number;
      functionPointer?: undefined;
    }
  | { kind: "Pause"; gapMs: number; pointerType?: HidPointerType; pointerValue?: number; keycode?: number; modifiers?: number; holdMs?: number; functionPointer?: undefined }
  | { kind: "Function"; functionPointer: string; gapMs: number; functionValue?: number; keycode?: number; modifiers?: number; holdMs?: number; pointerType?: HidPointerType; pointerValue?: number }
  | { kind: "Mouse"; pointerType: HidPointerType; pointerValue: number; gapMs: number; keycode?: number; modifiers?: number; holdMs?: number; functionPointer?: string };

export type HidBindingDto = { type: "Sequence"; steps: HidStepDto[] };

export type InputLayoutDto = {
  pin: number;
  activeLow: boolean;
  bootloaderOnBoot: boolean;
  bootloaderChordMember: boolean;
};

export type ButtonLayoutDto = InputLayoutDto & {
  id: number;
  ledIndex: number;
};

export type EncoderLayoutDto = {
  id: number;
  pinA: number;
  pinB: number;
  press?: InputLayoutDto;
};

export type DeviceLayoutDto = {
  buttons: ButtonLayoutDto[];
  encoders: EncoderLayoutDto[];
  neoPixelPin: number;
  neoPixelReversed: boolean;
  displayRows?: number[];
};

export type BindingProfileDto = {
  buttons: { id: number; binding: HidBindingDto }[];
  encoders: { id: number; clockwise: HidBindingDto; counterClockwise: HidBindingDto; press?: HidBindingDto }[];
};

export type KnownDeviceProfile = { name: string; layout: DeviceLayoutDto; defaultBindings: BindingProfileDto };

const key = (ch: string, modifiers = 0): HidStepDto => ({ kind: "Key", keycode: ch.charCodeAt(0), modifiers, holdMs: 10, gapMs: 10 });
const fnStep = (fn: string, gapMs = 0): HidStepDto => ({ kind: "Function", functionPointer: fn, gapMs });
const seq = (sequence: string, modifiers = 0): HidBindingDto => ({ type: "Sequence", steps: sequence.split("").map((c) => key(c, modifiers)) });
const fnBinding = (fn: string): HidBindingDto => ({ type: "Sequence", steps: [fnStep(fn)] });

export const DEVICE_PROFILES: Record<string, KnownDeviceProfile> = {
  "76-190-65-190": {
    name: "2 Keys",
    layout: {
      buttons: [
        { id: 0, pin: 14, activeLow: true, ledIndex: -1, bootloaderOnBoot: true, bootloaderChordMember: false },
        { id: 1, pin: 32, activeLow: true, ledIndex: -1, bootloaderOnBoot: false, bootloaderChordMember: false },
      ],
      encoders: [],
      neoPixelPin: -1,
      neoPixelReversed: false,
    },
    defaultBindings: {
      buttons: [
        { id: 0, binding: seq("1", 0) },
        { id: 1, binding: seq("2", 0) },
      ],
      encoders: [],
    },
  },
  "126-80-44-189": {
    name: "3 Keys 1 Knob",
    layout: {
      buttons: [
        { id: 0, pin: 16, activeLow: true, ledIndex: 2, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 1, pin: 17, activeLow: true, ledIndex: 1, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 2, pin: 11, activeLow: true, ledIndex: 0, bootloaderOnBoot: false, bootloaderChordMember: true },
      ],
      encoders: [
        { id: 0, pinA: 31, pinB: 30, press: { pin: 33, activeLow: true, bootloaderOnBoot: true, bootloaderChordMember: false } },
      ],
      neoPixelPin: 34,
      neoPixelReversed: false,
      displayRows: [3],
    },
    defaultBindings: {
      buttons: [
        { id: 0, binding: seq("a", 0) },
        { id: 1, binding: seq("b", 0) },
        { id: 2, binding: seq("c", 0) },
      ],
      encoders: [
        { id: 0, clockwise: fnBinding("hid_consumer_volume_up"), counterClockwise: fnBinding("hid_consumer_volume_down"), press: { type: "Sequence", steps: [key("E", 2), key("n", 0), key("t", 0), key("e", 0), key("r", 0)] } },
      ],
    },
  },
  "49-174-205-190": {
    name: "4 Keys",
    layout: {
      buttons: [
        { id: 0, pin: 15, activeLow: true, ledIndex: 0, bootloaderOnBoot: true, bootloaderChordMember: true },
        { id: 1, pin: 16, activeLow: true, ledIndex: 1, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 2, pin: 17, activeLow: true, ledIndex: 2, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 3, pin: 11, activeLow: true, ledIndex: 3, bootloaderOnBoot: false, bootloaderChordMember: true },
      ],
      encoders: [],
      neoPixelPin: 34,
      neoPixelReversed: true,
      displayRows: [4],
    },
    defaultBindings: {
      buttons: [
        { id: 0, binding: seq("1", 0) },
        { id: 1, binding: seq("2", 0) },
        { id: 2, binding: seq("3", 0) },
        { id: 3, binding: seq("4", 0) },
      ],
      encoders: [],
    },
  },
  "144-165-233-190": {
    name: "6 Keys 1 Knob",
    layout: {
      buttons: [
        { id: 0, pin: 32, activeLow: true, ledIndex: 0, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 1, pin: 14, activeLow: true, ledIndex: 1, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 2, pin: 15, activeLow: true, ledIndex: 2, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 3, pin: 16, activeLow: true, ledIndex: 3, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 4, pin: 17, activeLow: true, ledIndex: 4, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 5, pin: 11, activeLow: true, ledIndex: 5, bootloaderOnBoot: false, bootloaderChordMember: true },
      ],
      encoders: [
        { id: 0, pinA: 31, pinB: 30, press: { pin: 33, activeLow: true, bootloaderOnBoot: true, bootloaderChordMember: false } },
      ],
      neoPixelPin: 34,
      neoPixelReversed: true,
      displayRows: [3, 3],
    },
    defaultBindings: {
      buttons: [
        { id: 0, binding: seq("1", 0) },
        { id: 1, binding: seq("2", 0) },
        { id: 2, binding: seq("3", 0) },
        { id: 3, binding: seq("4", 0) },
        { id: 4, binding: seq("5", 0) },
        { id: 5, binding: seq("6", 0) },
      ],
      encoders: [
        { id: 0, clockwise: fnBinding("hid_consumer_volume_up"), counterClockwise: fnBinding("hid_consumer_volume_down"), press: { type: "Sequence", steps: [key("E", 2), key("n", 0), key("t", 0), key("e", 0), key("r", 0)] } },
      ],
    },
  },
  "24-26-109-190": {
    name: "10 Keys",
    layout: {
      buttons: [
        { id: 0, pin: 32, activeLow: true, ledIndex: -1, bootloaderOnBoot: true, bootloaderChordMember: true },
        { id: 1, pin: 14, activeLow: true, ledIndex: -1, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 2, pin: 15, activeLow: true, ledIndex: -1, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 3, pin: 16, activeLow: true, ledIndex: -1, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 4, pin: 17, activeLow: true, ledIndex: -1, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 5, pin: 31, activeLow: true, ledIndex: -1, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 6, pin: 30, activeLow: true, ledIndex: -1, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 7, pin: 11, activeLow: true, ledIndex: -1, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 8, pin: 33, activeLow: true, ledIndex: -1, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 9, pin: 34, activeLow: true, ledIndex: -1, bootloaderOnBoot: false, bootloaderChordMember: true },
      ],
      encoders: [],
      neoPixelPin: -1,
      neoPixelReversed: false,
      displayRows: [10],
    },
    defaultBindings: {
      buttons: [
        { id: 0, binding: seq("0", 0) },
        { id: 1, binding: seq("1", 0) },
        { id: 2, binding: seq("2", 0) },
        { id: 3, binding: seq("3", 0) },
        { id: 4, binding: seq("4", 0) },
        { id: 5, binding: seq("5", 0) },
        { id: 6, binding: seq("6", 0) },
        { id: 7, binding: seq("7", 0) },
        { id: 8, binding: seq("8", 0) },
        { id: 9, binding: seq("9", 0) },
      ],
      encoders: [],
    },
      "165-238-32-190": {
    name: "Sikai 6 Keys 1 Knob",
    layout: {
      buttons: [
        { id: 0, pin: 11, activeLow: true, ledIndex: 0, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 1, pin: 17, activeLow: true, ledIndex: 1, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 2, pin: 16, activeLow: true, ledIndex: 2, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 3, pin: 15, activeLow: true, ledIndex: 3, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 4, pin: 14, activeLow: true, ledIndex: 4, bootloaderOnBoot: false, bootloaderChordMember: true },
        { id: 5, pin: 32, activeLow: true, ledIndex: 5, bootloaderOnBoot: false, bootloaderChordMember: true },
      ],
      encoders: [
        { id: 0, pinA: 31, pinB: 30, press: { pin: 33, activeLow: true, bootloaderOnBoot: true, bootloaderChordMember: false } },
      ],
      neoPixelPin: 34,
      neoPixelReversed: false,
      displayRows: [3, 3],
    },
    defaultBindings: {
      buttons: [
        { id: 0, binding: fnBinding("hid_consumer_media_previous") },
        { id: 1, binding: fnBinding("hid_consumer_media_play_pause") },
        { id: 2, binding: fnBinding("hid_consumer_media_next") },
        { id: 3, binding: seq("c", 1) },
        { id: 4, binding: seq("x", 1) },
        { id: 5, binding: seq("v", 1) },
      ],
      encoders: [
        { id: 0, clockwise: fnBinding("hid_consumer_volume_up"), counterClockwise: fnBinding("hid_consumer_volume_down"), press: fnBinding("hid_consumer_mute") },
      ],
    },
  },
  },  
};

export function findProfileForBootloaderId(id: number[]): KnownDeviceProfile | null {
  const key = id.join("-");
  return DEVICE_PROFILES[key] ?? null;
}
