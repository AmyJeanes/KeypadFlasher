import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ConnectSpinner } from "./ConnectSpinner";
import { useModalClosing } from "../hooks/useModalClosing";
import type { Status } from "../types";

type ConnectWizardStep = { id: "keypad" | "windows-driver" | "bootloader" | "connect"; title: string };
type WizardShot = { src: string; alt: string; title: string };

type ConnectWizardProps = {
  isOpen: boolean;
  status: Status;
  isWindows: boolean;
  onClose: () => void;
  onRequestConnect: () => Promise<void>;
};

const formatWizardWarning = (msg: string): string => (msg.startsWith("No device selected")
  ? "No device selected. Please make sure your device is in bootloader mode and try again."
  : msg);

export function ConnectWizard({ isOpen, status, isWindows, onClose, onRequestConnect }: ConnectWizardProps) {
  const [connectWizardStep, setConnectWizardStep] = useState<number>(0);
  const [wizardWarning, setWizardWarning] = useState<string | null>(null);
  const [wizardShotPreview, setWizardShotPreview] = useState<WizardShot | null>(null);
  const wizardBodyShellRef = useRef<HTMLDivElement | null>(null);
  const wizardBodyContentRef = useRef<HTMLDivElement | null>(null);
  const [wizardBodyHeight, setWizardBodyHeight] = useState<number | null>(null);
  const [wizardBodyMaxHeight, setWizardBodyMaxHeight] = useState<number | null>(null);
  const [wizardBodyOverflow, setWizardBodyOverflow] = useState<boolean>(false);
  const wizardCancelByStepRef = useRef<boolean>(false);

  const connectWizardSteps: ConnectWizardStep[] = useMemo(() => {
    const steps: ConnectWizardStep[] = [];
    steps.push({ id: "keypad", title: "Get a keypad" });
    if (isWindows) {
      steps.push({ id: "windows-driver", title: "Install driver" });
    }
    steps.push({ id: "bootloader", title: "Enter bootloader mode" });
    steps.push({ id: "connect", title: "Connect" });
    return steps;
  }, [isWindows]);

  const bootloaderStepIndex = useMemo(
    () => connectWizardSteps.findIndex((step) => step.id === "bootloader"),
    [connectWizardSteps],
  );
  const connectStepIndex = useMemo(
    () => connectWizardSteps.findIndex((step) => step.id === "connect"),
    [connectWizardSteps],
  );

  const modalPointerDownRef = useRef<boolean>(false);
  const wizardModal = useModalClosing(isOpen, () => {
    setWizardWarning(null);
    onClose();
  });
  const { isClosing: connectWizardClosing, requestClose: requestConnectWizardClose, handleAnimationEnd: handleConnectWizardAnimationEnd } = wizardModal;

  const isWizardShotPreviewOpen = wizardShotPreview != null;
  const wizardShotModal = useModalClosing(isWizardShotPreviewOpen, () => setWizardShotPreview(null));
  const { isClosing: wizardShotClosing, requestClose: requestWizardShotClose, handleAnimationEnd: handleWizardShotAnimationEnd } = wizardShotModal;

  const hasWizardSteps = connectWizardSteps.length > 0;
  const wizardStepIndex = hasWizardSteps ? Math.min(connectWizardStep, connectWizardSteps.length - 1) : 0;
  const activeWizardStep = hasWizardSteps ? connectWizardSteps[wizardStepIndex] : null;
  const wizardHasPrev = wizardStepIndex > 0;
  const wizardHasNext = wizardStepIndex < connectWizardSteps.length - 1;
  const wizardConnectStep = activeWizardStep?.id === "connect";

  const wizardPrimaryLabel = (() => {
    if (activeWizardStep?.id === "bootloader") return "Connect";
    if (activeWizardStep?.id === "connect") return "Retry connect";
    return wizardHasNext ? "Next" : "Connect";
  })();

  useLayoutEffect(() => {
    const shellEl = wizardBodyShellRef.current;
    const contentEl = wizardBodyContentRef.current;
    if (!shellEl || !contentEl || typeof ResizeObserver === "undefined") return undefined;

    const calcMaxHeight = () => Math.max(260, Math.floor(window.innerHeight - 240));

    const measure = () => {
      const maxHeight = calcMaxHeight();
      const contentHeight = contentEl.scrollHeight;
      const nextHeight = Math.min(contentHeight, maxHeight);
      setWizardBodyHeight((prev) => (prev === nextHeight ? prev : nextHeight));
      setWizardBodyMaxHeight((prev) => (prev === maxHeight ? prev : maxHeight));
      setWizardBodyOverflow(contentHeight > maxHeight + 1);
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(contentEl);

    const handleWindowResize = () => measure();
    window.addEventListener("resize", handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [activeWizardStep, isOpen]);

  const renderWizardStepBody = useCallback((step: ConnectWizardStep | null): ReactNode => {
    if (!step) return null;
    const openWizardShotPreview = (src: string, title: string) => setWizardShotPreview({ src, alt: title, title });
    const renderWizardShot = (src: string, title: string) => (
      <button
        type="button"
        className="wizard-shot"
        onClick={() => openWizardShotPreview(src, title)}
      >
        <img src={src} alt={title} loading="lazy" />
        <div className="wizard-shot-caption">{title}</div>
      </button>
    );
    if (step.id === "keypad") {
      return (
        <div className="wizard-grid">
          <div className="wizard-copy">
            <p className="wizard-foreword">You will need to have a compatible keypad to use this project.</p>
            <p className="wizard-foreword">If you don't have one yet, here are some tips to get the right one:</p>
            <ul className="wizard-list">
              <li>
                <strong>Pick a supported device</strong>
                <ul className="wizard-sublist">
                  <li>Browse the <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher#supported-devices" target="_blank" rel="noreferrer">supported devices list</a> to see all currently supported keypads</li>
                  <li>Other keypads not on this list may be compatible, but will need to be added to this project first. See the <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher/blob/main/docs/development.md#adding-support-for-new-keypads" target="_blank" rel="noreferrer">developer instructions</a> for how to add support for new devices</li>
                </ul>
              </li>
              <li>
                <strong>Avoid incompatible boards</strong>
                <ul className="wizard-sublist">
                  <li>Some keypads use incompatible boards such as the CH57x or CH32 microcontrollers</li>
                  <li>See the <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher#unsupported-devices" target="_blank" rel="noreferrer">unsupported devices</a> documentation for more information</li>
                </ul>
              </li>
              <li>
                <strong>Lighting controls</strong>
                <ul className="wizard-sublist">
                  <li>Some keypads come with fixed or non-standard LEDs, so lighting controls may be limited on these devices</li>
                </ul>
              </li>
              <li>
                <strong>Bootloader mode</strong>
                <ul className="wizard-sublist">
                  <li>You will need to be able to enter bootloader mode on your keypad to flash the firmware</li>
                  <li>This is covered in more detail in the next step, but be aware before you get a keypad that you may need to purchase or build a bootloader adapter for most keypads</li>
                  <li>An <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher/blob/main/docs/bootloader.md#official-adapter" target="_blank" rel="noreferrer">official bootloader adapter</a> is available for purchase to make it as easy as possible to use</li>
                </ul>
              </li>
            </ul>
          </div>
          <div className="wizard-placeholders">
            {renderWizardShot("/img/keypads.jpg", "Examples of supported keypads")}
          </div>
        </div>
      );
    }
    if (step.id === "windows-driver") {
      return (
        <div className="wizard-grid">
          <div className="wizard-copy">
            <p className="wizard-foreword">Windows requires a driver to be installed before the browser can recognize the device in bootloader mode. Linux / macOS devices do not require this step.</p>
            <p>If you have already installed the driver please skip to the next step. You only need to install it once as a one-time setup for all keypads.</p>
            <ol className="wizard-list">
              <li>Download <a className="link" href="https://zadig.akeo.ie/" target="_blank" rel="noreferrer">Zadig</a> and open it. Administrative privileges may be required</li>
              <li>Press <strong>Device → Create New Device</strong></li>
              <li>Set the name to "CH55x Bootloader"</li>
              <li>Set USB ID to <code>4348</code> <code>55E0</code></li>
              <li>Ensure the WinUSB driver is selected, it should be by default anyway</li>
              <li>Press <strong>Install Driver</strong>, this may take a few minutes</li>
            </ol>
          </div>
          <div className="wizard-placeholders">
            {renderWizardShot("/img/zadig-1.png", "Zadig driver setup part 1")}
            {renderWizardShot("/img/zadig-2.png", "Zadig driver setup part 2")}
          </div>
        </div>
      );
    }

    if (step.id === "bootloader") {
      return (
        <div className="wizard-grid">
          <div className="wizard-copy">
            <p className="wizard-foreword">Get the keypad into bootloader mode so the flasher can communicate with it.</p>
            <ul className="wizard-list">
              <li>
                <strong>Keypad buttons</strong>
                <ul className="wizard-sublist">
                  <li>If you've flashed this firmware previously, you can use your configured bootloader buttons to enter bootloader mode easily</li>
                  <li>The default configuration is to press the first dial (or button if no dial) while plugging in. If you have more than 2 buttons you can also press all of them at any time as well</li>
                  <li>Check the <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher/blob/main/docs/bootloader.md#bootloader-buttons" target="_blank" rel="noreferrer">bootloader buttons guide</a> if you wish to customize the bootloader entry</li>
                </ul>
              </li>
              <li>
                <strong>Use the <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher/blob/main/docs/bootloader.md#official-adapter" target="_blank" rel="noreferrer">official adapter</a> (recommended)</strong>
                <ul className="wizard-sublist">
                  <li>Connect the adapter to your device and the keypad to the adapter's USB receptacle</li>
                  <li>Hold BOOT, tap RESET once, then release BOOT again</li>
                  <li>You can purchase it from <a className="link" href="https://www.ebay.com/itm/168130551869" target="_blank" rel="noreferrer">here</a> if you would like to buy one</li>
                </ul>
              </li>
              <li>
                <strong>Use built-in keypad jumpers</strong>
                <ul className="wizard-sublist">
                  <li>Some keypads have jumper pads that can be shorted to enter bootloader mode</li>
                  <li>Check the <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher/blob/main/docs/bootloader.md#devices" target="_blank" rel="noreferrer">devices guide</a> to see if your keypad supports this and how to do it</li>
                  <li>If it does not, you will need to use the official adapter or build a DIY adapter</li>
                </ul>
              </li>
              <li>
                <strong>DIY adapter</strong>
                <ul className="wizard-sublist">
                  <li>You can also build your own adapter to enter bootloader mode if you can't or prefer not to buy the official adapter for any reason</li>
                  <li>This may also be a preferable option if you have electronics experience and most of the necessary parts already to hand</li>
                  <li>See the <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher/blob/main/docs/bootloader.md#diy-adapter" target="_blank" rel="noreferrer">DIY adapter guide</a> for instructions on how to build one</li>
                </ul>
              </li>
            </ul>
            <div className="muted small">You will have about 10 seconds to connect after entering bootloader mode or you'll need to try again.</div>
          </div>
          <div className="wizard-placeholders">
            {renderWizardShot("/img/bootloader-button.jpg", "Entering the bootloader by holding the dial button while plugging in")}
            {renderWizardShot("/img/official-adapter.jpg", "Official CH55x bootloader adapter")}
          </div>
        </div>
      );
    }

    return (
      <div className="wizard-connect">
        <ConnectSpinner inline />
      </div>
    );
  }, []);

  const startWizardConnect = useCallback(async () => {
    wizardCancelByStepRef.current = false;
    setWizardWarning(null);
    if (connectStepIndex >= 0) {
      setConnectWizardStep(connectStepIndex);
    }
    try {
      await onRequestConnect();
    } catch (err) {
      const warning = formatWizardWarning(String((err as Error)?.message ?? err));
      if (wizardCancelByStepRef.current) {
        wizardCancelByStepRef.current = false;
        return;
      }
      setWizardWarning(warning);
      setConnectWizardStep(bootloaderStepIndex >= 0 ? bootloaderStepIndex : 0);
    } finally {
      wizardCancelByStepRef.current = false;
    }
  }, [bootloaderStepIndex, connectStepIndex, onRequestConnect]);

  const handleWizardPrimary = () => {
    if (activeWizardStep?.id === "bootloader" || activeWizardStep?.id === "connect") {
      void startWizardConnect();
      return;
    }
    if (wizardHasNext) {
      setWizardWarning(null);
      setConnectWizardStep(Math.min(connectWizardSteps.length - 1, wizardStepIndex + 1));
      return;
    }
    void startWizardConnect();
  };

  useEffect(() => {
    if (!isOpen) return;
    setWizardWarning(null);
    setConnectWizardStep(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (status.state === "connectedKnown" || status.state === "connectedUnknown") {
      setWizardWarning(null);
      requestConnectWizardClose();
    }
  }, [isOpen, requestConnectWizardClose, status.state]);

  if (!isOpen && !connectWizardClosing && !isWizardShotPreviewOpen && !wizardShotClosing) {
    return null;
  }

  return (
    <>
      {(isOpen || connectWizardClosing) && activeWizardStep && (
        <div
          className={`modal-backdrop${connectWizardClosing ? " closing" : ""}`}
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (modalPointerDownRef.current) { modalPointerDownRef.current = false; return; }
            if (status.state === "requesting") return;
            if (e.target === e.currentTarget) requestConnectWizardClose();
          }}
          onAnimationEnd={(e) => handleConnectWizardAnimationEnd(e.animationName)}
        >
          <div
            className={`modal config-modal setup-wizard-modal${wizardConnectStep ? " setup-wizard-modal-connect" : ""}${connectWizardClosing ? " closing" : ""}`}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={() => { modalPointerDownRef.current = true; }}
            onMouseUp={() => { modalPointerDownRef.current = false; }}
            onAnimationEnd={(e) => handleConnectWizardAnimationEnd(e.animationName)}
          >
            <div className="modal-header" style={{ alignItems: "flex-start" }}>
              <div>
                <div className="modal-title">Connection wizard</div>
              </div>
            </div>

            {wizardWarning && (
              <div className="status-banner status-warn" style={{ margin: "10px 0 6px" }}>
                <div className="status-title">Connection failed</div>
                <div className="status-body">{wizardWarning}</div>
              </div>
            )}

            <div className="wizard-steps" aria-hidden="true">
              {connectWizardSteps.map((step, idx) => (
                <button
                  key={step.id}
                  className={`wizard-step${idx === wizardStepIndex ? " wizard-step-active" : ""}`}
                  onClick={() => {
                    const cancellingConnectByStep = status.state === "requesting" && wizardConnectStep && step.id !== "connect";
                    if (cancellingConnectByStep) {
                      wizardCancelByStepRef.current = true;
                    }
                    setWizardWarning(null);
                    setConnectWizardStep(idx);
                    if (step.id === "connect" && status.state !== "requesting") {
                      void startWizardConnect();
                    }
                  }}
                  type="button"
                >
                  <div className="wizard-step-index">{idx + 1}</div>
                  <div className="wizard-step-title">{step.title}</div>
                </button>
              ))}
            </div>

            <div
              className={`modal-body wizard-body-shell${wizardBodyOverflow ? " wizard-body-shell-scroll" : ""}`}
              ref={wizardBodyShellRef}
              style={{
                height: wizardBodyHeight != null ? `${wizardBodyHeight}px` : undefined,
                maxHeight: wizardBodyMaxHeight != null ? `${wizardBodyMaxHeight}px` : undefined,
              }}
            >
              <div className="wizard-body" ref={wizardBodyContentRef}>
                {renderWizardStepBody(activeWizardStep)}
              </div>
            </div>

            <div className="wizard-footer">
              <div className="wizard-actions" style={{ width: "100%", justifyContent: "flex-end" }}>
                <button className="btn" onClick={requestConnectWizardClose}>Cancel</button>
                <button
                  className="btn"
                  disabled={!wizardHasPrev}
                  onClick={() => {
                    setWizardWarning(null);
                    setConnectWizardStep(Math.max(0, wizardStepIndex - 1));
                  }}
                >Previous</button>
                <button
                  className="btn btn-primary"
                  onClick={handleWizardPrimary}
                  disabled={status.state === "requesting"}
                >{wizardPrimaryLabel}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(isWizardShotPreviewOpen || wizardShotClosing) && wizardShotPreview && (
        <div
          className={`modal-backdrop${wizardShotClosing ? " closing" : ""}`}
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (modalPointerDownRef.current) { modalPointerDownRef.current = false; return; }
            if (e.target === e.currentTarget) requestWizardShotClose();
          }}
          onAnimationEnd={(e) => handleWizardShotAnimationEnd(e.animationName)}
        >
          <div
            className={`modal wizard-lightbox${wizardShotClosing ? " closing" : ""}`}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={() => { modalPointerDownRef.current = true; }}
            onMouseUp={() => { modalPointerDownRef.current = false; }}
            onAnimationEnd={(e) => handleWizardShotAnimationEnd(e.animationName)}
          >
            <img src={wizardShotPreview.src} alt={wizardShotPreview.alt} />
            <div className="wizard-lightbox-footer">
              <div className="wizard-lightbox-title">{wizardShotPreview.title}</div>
              <div className="wizard-actions" style={{ justifyContent: "flex-end" }}>
                <button className="btn" onClick={requestWizardShotClose}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}