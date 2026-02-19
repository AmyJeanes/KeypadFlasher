import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearStoredConfig,
  cloneLayout,
  loadConnectWizardHidden,
  loadLastBootloaderId,
  loadLastDemoKey,
  loadStoredConfig,
  saveConnectWizardHidden,
  saveLastBootloaderId,
  saveLastDemoKey,
  saveStoredConfig,
} from "./layoutStorage";
import { sampleBindings, sampleLayout, sampleLedConfig } from "../test/fixtures";

describe("layoutStorage", () => {
  const id = [9, 9, 9, 9];

  const resetStorage = () => {
    const storage = window.localStorage as Storage;
    const keys: string[] = [];
    for (let idx = 0; idx < storage.length; idx += 1) {
      const key = storage.key(idx);
      if (key) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  };

  beforeEach(() => {
    resetStorage();
  });

  it("clones layout deeply enough for editor use", () => {
    const cloned = cloneLayout(sampleLayout);
    expect(cloned).toEqual(sampleLayout);
    expect(cloned).not.toBe(sampleLayout);
    expect(cloned.buttons[0]).not.toBe(sampleLayout.buttons[0]);
  });

  it("saves and loads stored config by bootloader id", () => {
    saveStoredConfig(id, { bindings: sampleBindings, layout: sampleLayout, ledConfig: sampleLedConfig });
    const loaded = loadStoredConfig(id);
    expect(loaded?.bindings?.buttons).toHaveLength(2);
    expect(loaded?.layout?.buttons[0].id).toBe(0);
    expect(loaded?.ledConfig?.brightnessPercent).toBe(80);
  });

  it("clears corrupted stored config entries", () => {
    window.localStorage.setItem("keypad-flasher:9-9-9-9", "{oops");
    const removeSpy = vi.spyOn(window.localStorage, "removeItem");

    expect(loadStoredConfig(id)).toBeNull();
    expect(removeSpy).toHaveBeenCalledWith("keypad-flasher:9-9-9-9");
  });

  it("removes stored config when empty payload is saved", () => {
    saveStoredConfig(id, { bindings: sampleBindings, layout: sampleLayout, ledConfig: sampleLedConfig });
    saveStoredConfig(id, { bindings: null, layout: null, ledConfig: null });
    expect(loadStoredConfig(id)).toBeNull();

    clearStoredConfig(id);
    expect(loadStoredConfig(id)).toBeNull();
  });

  it("persists and restores last connected id and demo key", () => {
    saveLastBootloaderId([1, 2, 3, 4]);
    saveLastDemoKey("demo-1");

    expect(loadLastBootloaderId()).toEqual([1, 2, 3, 4]);
    expect(loadLastDemoKey()).toBe("demo-1");
  });

  it("stores connect wizard hidden flag", () => {
    expect(loadConnectWizardHidden()).toBe(false);
    saveConnectWizardHidden(true);
    expect(loadConnectWizardHidden()).toBe(true);
  });
});
