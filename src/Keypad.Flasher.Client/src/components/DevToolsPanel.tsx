import { type Dispatch, type SetStateAction } from "react";
import { type ConnectedInfo } from "../lib/ch55xBootloader";
import { type DebugOptions as DebugOptionsDto } from "../hooks/useFirmwareFlashing";

export type DevToolsPanelProps = {
  debugFirmware: boolean;
  setDebugFirmware: Dispatch<SetStateAction<boolean>>;
  debugOptions: DebugOptionsDto;
  setDebugOptions: Dispatch<SetStateAction<DebugOptionsDto>>;
  classicDebugOptions: DebugOptionsDto;
  defaultDebugOptions: DebugOptionsDto;
  connectedInfo: ConnectedInfo | null;
};

export function DevToolsPanel(props: DevToolsPanelProps) {
  const {
    debugFirmware,
    setDebugFirmware,
    debugOptions,
    setDebugOptions,
    classicDebugOptions,
    defaultDebugOptions,
    connectedInfo,
  } = props;

  return (
    <div className="panel" style={{ marginBottom: "10px" }}>
      <div className="panel-header">
        <div className="panel-title">Development tools</div>
        <label className="checkbox">
          <input type="checkbox" checked={debugFirmware} onChange={(event) => setDebugFirmware(event.target.checked)} />
          Debug firmware (USB CDC)
        </label>
      </div>
      <p className="muted small">
        Use debug firmware to expose a USB CDC serial console for troubleshooting layouts. See the <a className="link" href="https://github.com/AmyJeanes/KeypadFlasher#adding-support-for-new-keypads" target="_blank" rel="noreferrer">adding support guide</a> for wiring notes, LED direction tips, and how to contribute new keypad profiles.
      </p>
      {debugFirmware && (
        <div className="card subtle" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Debug firmware options</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button className="btn" onClick={() => setDebugOptions(classicDebugOptions)}>Raw (no filtering/pull-ups)</button>
              <button className="btn" onClick={() => setDebugOptions(defaultDebugOptions)}>Reset defaults</button>
            </div>
          </div>
          <div className="muted small">
            Tweak how the debug logger handles floating pins and noisy edges.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
            <label className="checkbox" title="Majority-vote a few quick samples before logging a change to filter out glitches.">
              <input
                type="checkbox"
                checked={debugOptions.enableNoiseFilter}
                onChange={(e) => setDebugOptions((prev) => ({ ...prev, enableNoiseFilter: e.target.checked }))}
              />
              Enable noise filter
            </label>
            <label className="checkbox" title="Use INPUT_PULLUP on unassigned pins to bias floating lines high.">
              <input
                type="checkbox"
                checked={debugOptions.enablePullups}
                onChange={(e) => setDebugOptions((prev) => ({ ...prev, enablePullups: e.target.checked }))}
              />
              Pull-ups on unassigned pins
            </label>
            <label className="inline-input">
              <span className="input-label" title="How many quick samples to take when a pin flips before logging it.">Confirm samples</span>
              <input
                id="debug-confirm-samples"
                className="text-input"
                type="number"
                min={1}
                max={255}
                value={debugOptions.confirmSamples}
                onChange={(e) => setDebugOptions((prev) => ({ ...prev, confirmSamples: Number(e.target.value) || 1 }))}
              />
            </label>
            <label className="inline-input">
              <span className="input-label" title="Delay in milliseconds between confirmation samples when the filter is on.">Confirm delay (ms)</span>
              <input
                id="debug-confirm-delay"
                className="text-input"
                type="number"
                min={0}
                max={255}
                value={debugOptions.confirmDelayMs}
                onChange={(e) => setDebugOptions((prev) => ({ ...prev, confirmDelayMs: Math.max(0, Number(e.target.value) || 0) }))}
              />
            </label>
          </div>
        </div>
      )}
      <div className="card subtle" style={{ marginTop: "12px" }}>
        <div className="card-title">Connected device</div>
        <div>Bootloader: {connectedInfo ? connectedInfo.version : "n/a"}</div>
        <div>Bootloader ID: {connectedInfo ? connectedInfo.id.join(", ") : "n/a"}</div>
        <div>Device ID: {connectedInfo ? connectedInfo.deviceIdHex : "n/a"}</div>
      </div>
    </div>
  );
}
