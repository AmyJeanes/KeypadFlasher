import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectWizard } from "./ConnectWizard";

describe("ConnectWizard", () => {
  it("shows Windows driver step when running on Windows", () => {
    render(
      <ConnectWizard
        isOpen
        status={{ state: "idle" }}
        isWindows
        onClose={vi.fn()}
        onRequestConnect={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText("Install driver")).toBeTruthy();
  });

  it("shows friendly warning when connection fails with no device selected", async () => {
    render(
      <ConnectWizard
        isOpen
        status={{ state: "idle" }}
        isWindows={false}
        onClose={vi.fn()}
        onRequestConnect={vi.fn().mockRejectedValue(new Error("No device selected"))}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(screen.getByText(/Connection failed/i)).toBeTruthy();
      expect(screen.getByText(/Please make sure your device is in bootloader mode/i)).toBeTruthy();
    });
  });
});
