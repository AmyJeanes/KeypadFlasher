import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  // @ts-expect-error test shim
  window.ResizeObserver = ResizeObserver;
}

if (typeof window !== "undefined") {
  const maybeStorage = window.localStorage as Partial<Storage> | undefined;
  const missingStorageMethods = !maybeStorage
    || typeof maybeStorage.getItem !== "function"
    || typeof maybeStorage.setItem !== "function"
    || typeof maybeStorage.removeItem !== "function"
    || typeof maybeStorage.key !== "function";

  if (missingStorageMethods) {
    const store = new Map<string, string>();
    const shim: Storage = {
      get length() {
        return store.size;
      },
      clear() {
        store.clear();
      },
      getItem(key: string) {
        return store.has(key) ? store.get(key)! : null;
      },
      key(index: number) {
        return Array.from(store.keys())[index] ?? null;
      },
      removeItem(key: string) {
        store.delete(key);
      },
      setItem(key: string, value: string) {
        store.set(key, String(value));
      },
    };

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: shim,
    });
  }
}
