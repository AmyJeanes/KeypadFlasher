import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLightingState } from "./useLightingState";
import { sampleLedConfig } from "../test/fixtures";

describe("useLightingState", () => {
  it("opens/saves global lighting modal and updates brightness", () => {
    const { result } = renderHook(() => useLightingState({ initialLedConfig: sampleLedConfig }));

    act(() => result.current.openGlobalLightingModal());
    expect(result.current.showGlobalLightingModal).toBe(true);

    act(() => result.current.setBrightnessPercent(55));
    act(() => result.current.saveGlobalLightingModal());

    expect(result.current.ledConfig?.brightnessPercent).toBe(55);
    expect(result.current.showGlobalLightingModal).toBe(false);
  });

  it("copies and pastes per-led lighting values", () => {
    const { result } = renderHook(() => useLightingState({ initialLedConfig: sampleLedConfig }));

    act(() => result.current.openLightingModal(sampleLedConfig, 0));
    act(() => result.current.copyLedLighting(0, "Button 1"));
    act(() => result.current.pasteLedLighting(1, "Button 2"));

    expect(result.current.draftLedConfig?.leds[1].passiveMode).toBe(result.current.draftLedConfig?.leds[0].passiveMode);
    expect(result.current.lightingStatus).toContain("Pasted lighting");
  });

  it("applies one led configuration to all leds", () => {
    const { result } = renderHook(() => useLightingState({ initialLedConfig: sampleLedConfig }));

    act(() => result.current.openLightingModal(sampleLedConfig, 0));
    act(() => result.current.applyLightingToAll(0, "Button 1"));

    const leds = result.current.draftLedConfig?.leds ?? [];
    expect(leds[0].passiveMode).toBe(leds[1].passiveMode);
    expect(leds[0].activeMode).toBe(leds[1].activeMode);
  });
});
