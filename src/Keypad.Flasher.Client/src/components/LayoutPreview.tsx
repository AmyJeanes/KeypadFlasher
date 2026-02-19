import { useEffect, useRef, useState } from "react";
import type { HidBindingDto, DeviceLayoutDto } from "../lib/keypadConfigs";
import { describeBinding } from "../lib/bindingUtils";
import type { EditTarget, LedConfigurationDto } from "../types";
import { LightingPreview } from "./LightingPreview";
import "./LayoutPreview.css";

type LayoutPreviewProps = {
  layout: DeviceLayoutDto;
  layoutRows: number[];
  buttonBindings: Map<number, HidBindingDto>;
  encoderBindings: Map<number, { clockwise: HidBindingDto; counterClockwise: HidBindingDto; press?: HidBindingDto }>;
  ledConfig: LedConfigurationDto | null;
  warnNoBootEntry: boolean;
  warnSingleChord: boolean;
  onEdit: (target: EditTarget) => void;
  onOpenLightingForLed: (ledIndex: number) => void;
  onOpenLightingSettings?: () => void;
  lightingDisabled?: boolean;
  onToggleBootloaderOnBoot: (target: EditTarget, value: boolean) => void;
  onToggleBootloaderChord: (target: EditTarget, value: boolean) => void;
  onResetDefaults?: () => void;
  onExportConfig?: () => void;
  onImportConfig?: () => void;
  canReset?: boolean;
};

export function LayoutPreview({ layout, layoutRows, buttonBindings, encoderBindings, ledConfig, warnNoBootEntry, warnSingleChord, onEdit, onOpenLightingForLed, onOpenLightingSettings, lightingDisabled, onToggleBootloaderOnBoot, onToggleBootloaderChord, onResetDefaults, onExportConfig, onImportConfig, canReset }: LayoutPreviewProps) {
  const sortedButtons = [...layout.buttons].sort((a, b) => a.id - b.id);
  const encoderCount = layout.encoders.length;
  const [confirmReset, setConfirmReset] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [gridScrollable, setGridScrollable] = useState(false);
  const [touchArmedKey, setTouchArmedKey] = useState<string | null>(null);
  const touchDeviceRef = useRef<boolean>(false);
  const [animRevision, setAnimRevision] = useState(0);

  const isGridScrollable = (el: HTMLDivElement | null) => !!el && el.scrollWidth > el.clientWidth + 1;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasTouch = "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0 || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    touchDeviceRef.current = hasTouch;
  }, []);

  useEffect(() => {
    // Bump to remount animated tiles so rainbow/breathing stay in sync when timing changes.
    setAnimRevision((rev) => rev + 1);
  }, [ledConfig]);

  useEffect(() => {
    const el = gridRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const checkScrollable = () => {
      setGridScrollable(isGridScrollable(el));
    };
    checkScrollable();
    const observer = new ResizeObserver(checkScrollable);
    observer.observe(el);
    const inner = el.querySelector(".layout-scroll-inner");
    if (inner instanceof Element) observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  const handleGridPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // allow middle-click auto-scroll and right-click
    const target = e.target as HTMLElement | null;
    if (target && (target.closest(".button-tile .button-action") || target.closest(".encoder-binding-tile .button-action") || target.closest(".boot-toggle"))) return; // let action buttons click
    setTouchArmedKey(null);
    const el = e.currentTarget;
    if (!isGridScrollable(el)) return;
    el.setPointerCapture(e.pointerId);
    el.dataset.dragging = "1";
    el.dataset.dragStartX = String(e.clientX);
    el.dataset.dragStartScroll = String(el.scrollLeft);
  };

  const handleGridPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.dataset.dragging !== "1") return;
    const startX = Number(el.dataset.dragStartX || 0);
    const startScroll = Number(el.dataset.dragStartScroll || 0);
    const deltaX = e.clientX - startX;
    el.scrollLeft = startScroll - deltaX;
  };

  const handleGridPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.dataset.dragging === "1") {
      el.releasePointerCapture(e.pointerId);
      delete el.dataset.dragging;
      delete el.dataset.dragStartX;
      delete el.dataset.dragStartScroll;
    }
  };

  const handleActionClick = (tileKey: string, action: () => void, e: React.MouseEvent<HTMLElement>) => {
    if (touchDeviceRef.current) {
      if (touchArmedKey !== tileKey) {
        e.preventDefault();
        e.stopPropagation();
        setTouchArmedKey(tileKey);
        return;
      }
      setTouchArmedKey(null);
    }
    action();
  };

  const handleGridWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isGridScrollable(e.currentTarget)) return;
    // Convert vertical wheel to horizontal scroll when hovered
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      if (e.cancelable) e.preventDefault();
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  const handleTileTouchArm = (tileKey: string, e: React.MouseEvent<HTMLElement>) => {
    if (!touchDeviceRef.current) return;
    if (touchArmedKey !== tileKey) {
      e.preventDefault();
      e.stopPropagation();
      setTouchArmedKey(tileKey);
    }
  };

  const handleFlagToggle = (
    tileKey: string,
    target: EditTarget,
    currentValue: boolean,
    toggleFn: (target: EditTarget, value: boolean) => void,
    e: React.MouseEvent<HTMLElement>,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    // Bootloader flags are always visible; toggle immediately even on touch to avoid double-tap arming.
    if (touchDeviceRef.current) setTouchArmedKey(tileKey);
    toggleFn(target, !currentValue);
  };

  return (
    <div className="panel">
      <div className="panel-header layout-panel-header">
        <div className="layout-heading-text">
          <div className="panel-title">Layout</div>
          <div className="muted small">Click any button or encoder tile to change its bindings or lighting if available.</div>
        </div>
        <div className="layout-actions">
          {onOpenLightingSettings && (
            <button className="btn btn-primary" onClick={onOpenLightingSettings} disabled={lightingDisabled} title={lightingDisabled ? "No LEDs available" : undefined}>Global Lighting</button>
          )}
          {onExportConfig && <button className="btn" onClick={onExportConfig}>Export</button>}
          {onImportConfig && <button className="btn" onClick={onImportConfig}>Import</button>}
          {canReset && onResetDefaults && (
            <button className="btn btn-warn" onClick={() => setConfirmReset(true)}>Reset</button>
          )}
        </div>
      </div>
      <div className="muted small bootloader-legend" style={{ marginTop: "0.4rem" }}>
        <span className="legend-label">Bootloader configuration:</span>
        <span className="legend-item">
          <span className="material-symbols-outlined legend-icon">power</span>
          <span className="legend-text">Hold at power-up to enter bootloader.</span>
        </span>
        <span className="legend-item">
          <span className="material-symbols-outlined legend-icon">link</span>
          <span className="legend-text">Part of the bootloader chord you can press anytime.</span>
          <span className="legend-text">Press icons to configure.</span>
        </span>
      </div>
      {(warnNoBootEntry || warnSingleChord) && (
        <div className={`status-banner ${warnNoBootEntry ? "status-error" : "status-warn"}`} style={{ marginTop: "0.5rem" }}>
          <div className="status-title">Bootloader warning</div>
          <div className="status-body">
            {warnNoBootEntry && <div>No bootloader entry method configured. Enable key(s) on power up or add a chord so you can re-enter bootloader.</div>}
            {warnSingleChord && <div>Bootloader chord has only one member; disable entirely or add another to avoid accidental triggers.</div>}
          </div>
        </div>
      )}
      <div className={`layout-preview${encoderCount === 0 ? " no-encoders" : ""}`}>
        <div
          className={`layout-scroll${gridScrollable ? " scrollable" : ""}`}
          ref={gridRef}
          onPointerDown={handleGridPointerDown}
          onPointerMove={handleGridPointerMove}
          onPointerUp={handleGridPointerUp}
          onPointerLeave={handleGridPointerUp}
          onWheel={handleGridWheel}
          onClickCapture={() => { if (!touchDeviceRef.current && touchArmedKey) setTouchArmedKey(null); }}
        >
          <div className="layout-scroll-inner">
            {(() => {
              let buttonCursor = 0;
              return (
                <>
                  {encoderCount > 0 && (
                    <div className="encoder-column">
                      {layout.encoders.map((enc) => {
                        const bindings = encoderBindings.get(enc.id);
                        const ccw = describeBinding(bindings?.counterClockwise);
                        const cw = describeBinding(bindings?.clockwise);
                        const press = describeBinding(bindings?.press);
                        const pressBootloaderOnBoot = Boolean(enc.press?.bootloaderOnBoot);
                        const pressBootloaderChordMember = Boolean(enc.press?.bootloaderChordMember);
                        const pressBootIcon = pressBootloaderOnBoot ? "power" : "power_off";
                        const pressChordIcon = pressBootloaderChordMember ? "link" : "link_off";
                        const tileKey = `tile-enc-${enc.id}`;
                        const encoderTarget: EditTarget = { type: "encoder", encoderId: enc.id, direction: "press" };
                        return (
                          <div className="encoder-tile" key={enc.id}>
                            <div className="encoder-label">Encoder {enc.id + 1}</div>
                            <div className="encoder-binding-list">
                              <div
                                className="encoder-binding-tile"
                                onClick={(e) => handleTileTouchArm(tileKey, e)}
                              >
                                <div className="encoder-binding-main">
                                  <div className="encoder-binding-top"><span className="muted small">Counter-clockwise</span></div>
                                  <div className="encoder-binding-body">
                                    <span className="binding-text">{ccw}</span>
                                  </div>
                                </div>
                                <div className="encoder-binding-actions hover-actions">
                                  <button
                                    className="btn button-action"
                                    onClick={(e) => handleActionClick(tileKey, () => onEdit({ type: "encoder", encoderId: enc.id, direction: "ccw" }), e)}
                                  >
                                    Bindings
                                  </button>
                                </div>
                              </div>
                              <div
                                className="encoder-binding-tile"
                                onClick={(e) => handleTileTouchArm(tileKey, e)}
                              >
                                <div className="encoder-binding-main">
                                  <div className="encoder-binding-top"><span className="muted small">Clockwise</span></div>
                                  <div className="encoder-binding-body">
                                    <span className="binding-text">{cw}</span>
                                  </div>
                                </div>
                                <div className="encoder-binding-actions hover-actions">
                                  <button
                                    className="btn button-action"
                                    onClick={(e) => handleActionClick(tileKey, () => onEdit({ type: "encoder", encoderId: enc.id, direction: "cw" }), e)}
                                  >
                                    Bindings
                                  </button>
                                </div>
                              </div>
                              {enc.press && (
                                <div
                                  className="encoder-binding-tile"
                                  onClick={(e) => handleTileTouchArm(tileKey, e)}
                                >
                                  <div className="encoder-binding-main">
                                    <div className="encoder-binding-top">
                                      <button
                                        type="button"
                                        className={`button-flag boot-flag boot-toggle material-symbols-outlined${pressBootloaderOnBoot ? "" : " inactive"}`}
                                        aria-pressed={pressBootloaderOnBoot}
                                        onClick={(e) => handleFlagToggle(tileKey, encoderTarget, pressBootloaderOnBoot, onToggleBootloaderOnBoot, e)}
                                        title="Toggle bootloader on boot"
                                      >
                                        {pressBootIcon}
                                      </button>
                                      <span className="muted small">Press</span>
                                      <button
                                        type="button"
                                        className={`button-flag chord-flag boot-toggle material-symbols-outlined${pressBootloaderChordMember ? "" : " inactive"}`}
                                        aria-pressed={pressBootloaderChordMember}
                                        onClick={(e) => handleFlagToggle(tileKey, encoderTarget, pressBootloaderChordMember, onToggleBootloaderChord, e)}
                                        title="Toggle bootloader chord membership"
                                      >
                                        {pressChordIcon}
                                      </button>
                                    </div>
                                    <div className="encoder-binding-body">
                                      <span className="binding-text">{press}</span>
                                    </div>
                                  </div>
                                  <div className="encoder-binding-actions hover-actions">
                                    <button
                                      className="btn button-action"
                                      onClick={(e) => handleActionClick(tileKey, () => onEdit({ type: "encoder", encoderId: enc.id, direction: "press" }), e)}
                                    >
                                      Bindings
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="button-grid">
                    <div className="button-grid-inner">
                      {layoutRows.map((count, rowIdx) => (
                        <div
                          className="button-row"
                          key={`row-${rowIdx}`}
                        >
                          {Array.from({ length: count }).map((_, colIdx) => {
                            const button = sortedButtons[buttonCursor];
                            const tileKey = `tile-btn-${button ? button.id : `${rowIdx}-${colIdx}`}`;
                            const label = button ? `Button ${button.id + 1}` : `Button ${buttonCursor + 1}`;
                            const bootloaderOnBoot = Boolean(button?.bootloaderOnBoot);
                            const bootloaderChordMember = Boolean(button?.bootloaderChordMember);
                            const bootIcon = bootloaderOnBoot ? "power" : "power_off";
                            const chordIcon = bootloaderChordMember ? "link" : "link_off";
                            const binding = button ? describeBinding(buttonBindings.get(button.id)) : "Unassigned";
                            buttonCursor += 1;
                            const ledIndex = button ? button.ledIndex : -1;
                            const hasLed = !!ledConfig && ledIndex >= 0 && ledIndex < ledConfig.leds.length;
                            const led = hasLed && ledConfig ? ledConfig.leds[ledIndex] : null;
                            const passive = led?.passiveMode;
                            const passiveColor = led?.passiveColor;
                            const activeMode = led?.activeMode;
                            const activeColor = led?.activeColor;
                            const className = "button-tile clickable";
                            return (
                              <div
                                className={className}
                                key={`btn-${rowIdx}-${colIdx}-${animRevision}`}
                                onClick={(e) => handleTileTouchArm(tileKey, e)}
                              >
                                {hasLed && passive && passiveColor && (
                                  <div className="button-bg" aria-hidden="true">
                                    <LightingPreview
                                      passiveMode={passive}
                                      passiveColor={passiveColor}
                                      activeMode={activeMode}
                                      activeColor={activeColor}
                                      rainbowStepMs={led?.rainbowStepMs}
                                      breathingMinPercent={led?.breathingMinPercent}
                                      breathingStepMs={led?.breathingStepMs}
                                      ledIndex={ledIndex}
                                      size="md"
                                      interactive={false}
                                      muted
                                      style={{ width: "100%", height: "100%", pointerEvents: "none" }}
                                    />
                                  </div>
                                )}
                                <div className="button-main">
                                  <div className="button-label-row" title={label}>
                                    <button
                                      type="button"
                                      className={`button-flag boot-flag boot-toggle material-symbols-outlined${bootloaderOnBoot ? "" : " inactive"}`}
                                      aria-pressed={bootloaderOnBoot}
                                      disabled={!button}
                                      onClick={(e) => {
                                        if (!button) return;
                                        handleFlagToggle(tileKey, { type: "button", buttonId: button.id }, bootloaderOnBoot, onToggleBootloaderOnBoot, e);
                                      }}
                                      aria-disabled={!button}
                                      title="Toggle bootloader on boot"
                                    >
                                      {bootIcon}
                                    </button>
                                    <span className="button-label-pill small">{label}</span>
                                    <button
                                      type="button"
                                      className={`button-flag chord-flag boot-toggle material-symbols-outlined${bootloaderChordMember ? "" : " inactive"}`}
                                      aria-pressed={bootloaderChordMember}
                                      disabled={!button}
                                      onClick={(e) => {
                                        if (!button) return;
                                        handleFlagToggle(tileKey, { type: "button", buttonId: button.id }, bootloaderChordMember, onToggleBootloaderChord, e);
                                      }}
                                      aria-disabled={!button}
                                      title="Toggle bootloader chord membership"
                                    >
                                      {chordIcon}
                                    </button>
                                  </div>
                                  <span className="binding-text">{binding}</span>
                                </div>
                                <div className="button-tile-actions hover-actions">
                                  <button
                                    className="btn button-action"
                                    onClick={(e) => {
                                      handleActionClick(`tile-btn-${button ? button.id : `${rowIdx}-${colIdx}`}`, () => {
                                        if (button) onEdit({ type: "button", buttonId: button.id });
                                      }, e);
                                    }}
                                  >
                                    Bindings
                                  </button>
                                  <button
                                    className="btn button-action"
                                    disabled={!hasLed}
                                    onClick={(e) => {
                                      handleActionClick(`tile-btn-${button ? button.id : `${rowIdx}-${colIdx}`}`, () => {
                                        if (hasLed) onOpenLightingForLed(ledIndex);
                                      }, e);
                                    }}
                                    title={hasLed ? undefined : "No LED mapped for this key"}
                                  >
                                    {hasLed ? "Lighting" : "No LED"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
      {confirmReset && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setConfirmReset(false); }}>
          <div className="modal config-modal">
            <div className="modal-header">
              <div className="modal-title">Reset layout to defaults?</div>
            </div>
            <div className="stack" style={{ gap: "0.5rem", marginTop: "0.35rem" }}>
              <div className="muted">This will replace all button and encoder bindings with the default profile values.</div>
            </div>
            <div className="modal-actions" style={{ marginTop: "1rem" }}>
              <button className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button className="btn btn-warn" onClick={() => { setConfirmReset(false); onResetDefaults?.(); }}>Confirm reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
