import { describe, expect, it } from "vitest";
import {
  applyBootloaderConfigToLayout,
  bootloaderConfigFromLayout,
  cloneProfileLayout,
  sameBootloaderId,
  validateBindingProfileCandidate,
  validateBootloaderConfigCandidate,
  validateLedConfigCandidate,
} from "./configValidation";
import type { KnownDeviceProfile } from "./keypadConfigs";
import { sampleBindings, sampleLayout, sampleLedConfig } from "../test/fixtures";

describe("configValidation", () => {
  it("compares bootloader ids safely", () => {
    expect(sameBootloaderId([1, 2], [1, 2])).toBe(true);
    expect(sameBootloaderId([1, 2], [1, 3])).toBe(false);
    expect(sameBootloaderId([1], null)).toBe(false);
  });

  it("validates binding profile payloads", () => {
    const validated = validateBindingProfileCandidate(sampleBindings);
    expect(validated.buttons).toHaveLength(2);
    expect(validated.encoders[0].clockwise.type).toBe("Sequence");

    expect(() => validateBindingProfileCandidate({ buttons: [] })).toThrow(/encoders array/i);
  });

  it("validates bootloader config payloads", () => {
    const cfg = bootloaderConfigFromLayout(sampleLayout);
    const validated = validateBootloaderConfigCandidate(cfg);
    expect(validated.buttons[0].bootloaderOnBoot).toBe(true);

    expect(() => validateBootloaderConfigCandidate({ buttons: [{}], encoders: [] })).toThrow(/id/i);
  });

  it("validates led config payloads", () => {
    const validated = validateLedConfigCandidate(sampleLedConfig);
    expect(validated.leds).toHaveLength(2);
    expect(validated.brightnessPercent).toBe(80);

    expect(() => validateLedConfigCandidate({ leds: [], brightnessPercent: "bad" })).toThrow(/brightnessPercent/i);
  });

  it("applies bootloader config onto an existing layout", () => {
    const cfg = bootloaderConfigFromLayout(sampleLayout);
    cfg.buttons[0].bootloaderOnBoot = false;
    cfg.encoders[0].press = { bootloaderOnBoot: true, bootloaderChordMember: true };

    const updated = applyBootloaderConfigToLayout(sampleLayout, cfg);
    expect(updated.buttons[0].bootloaderOnBoot).toBe(false);
    expect(updated.encoders[0].press?.bootloaderOnBoot).toBe(true);
    expect(updated).not.toBe(sampleLayout);
  });

  it("clones profile layout when available", () => {
    const profile: KnownDeviceProfile = {
      name: "Test",
      bootloaderIds: ["1-2-3-4"],
      layout: sampleLayout,
      defaultBindings: sampleBindings,
    };

    const cloned = cloneProfileLayout(profile);
    expect(cloned).toEqual(sampleLayout);
    expect(cloned).not.toBe(sampleLayout);
    expect(cloneProfileLayout(null)).toBeNull();
  });
});
