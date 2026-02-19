import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionBar } from "./ActionBar";

function buildProps(overrides: Partial<React.ComponentProps<typeof ActionBar>> = {}): React.ComponentProps<typeof ActionBar> {
  return {
    demoMode: false,
    connectedInfo: null,
    devMode: false,
    hexDragOver: false,
    clientRef: { current: null },
    handleConnectClick: vi.fn(),
    handleDemoToggle: vi.fn(),
    handleDisconnect: vi.fn().mockResolvedValue(undefined),
    handleHexClick: vi.fn(),
    handleHexDragOver: vi.fn(),
    handleHexDragLeave: vi.fn(),
    handleHexDrop: vi.fn(),
    fileInputRef: { current: null },
    onHexFileChange: vi.fn(),
    compileAndFlash: vi.fn().mockResolvedValue(undefined),
    selectedLayout: null,
    debugFirmware: false,
    ...overrides,
  };
}

describe("ActionBar", () => {
  it("shows connect + demo buttons when not connected and not in demo mode", () => {
    render(<ActionBar {...buildProps()} />);

    expect(screen.getByRole("button", { name: "Connect" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start Demo" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Disconnect" })).toBeNull();
  });

  it("shows disconnect button when connected and invokes reboot disconnect", () => {
    const handleDisconnect = vi.fn().mockResolvedValue(undefined);
    render(<ActionBar {...buildProps({ connectedInfo: { id: [1, 2, 3, 4], version: "1.0.0", deviceIdHex: "0x52" }, handleDisconnect })} />);

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(handleDisconnect).toHaveBeenCalledWith(true);
  });

  it("disables Compile & Flash when no client or no layout in normal mode", () => {
    render(<ActionBar {...buildProps({ clientRef: { current: null }, selectedLayout: null, debugFirmware: false })} />);

    const compileButton = screen.getByRole("button", { name: "Compile & Flash" }) as HTMLButtonElement;
    expect(compileButton.disabled).toBe(true);
  });

  it("enables Compile & Flash in debug firmware mode even without layout", () => {
    render(<ActionBar {...buildProps({ clientRef: { current: { ping: async () => {}, connect: async () => ({ id: [1], version: "", deviceIdHex: "" }), disconnect: async () => {}, flashBinary: async () => {}, getConnectedDevice: () => null, runApplication: async () => {} } }, selectedLayout: null, debugFirmware: true })} />);

    const compileButton = screen.getByRole("button", { name: "Compile & Flash" }) as HTMLButtonElement;
    expect(compileButton.disabled).toBe(false);
  });

  it("shows upload hex controls only in dev mode", () => {
    const { rerender } = render(<ActionBar {...buildProps({ devMode: false })} />);
    expect(screen.queryByRole("button", { name: "Upload .hex" })).toBeNull();

    rerender(<ActionBar {...buildProps({ devMode: true, clientRef: { current: {} as never } })} />);
    expect(screen.getByRole("button", { name: "Upload .hex" })).toBeTruthy();
  });
});
