import { type MutableRefObject, type DragEvent, type ChangeEvent } from "react";
import { type ConnectedInfo, type BootloaderClient } from "../lib/ch55xBootloader";
import { type DeviceLayoutDto } from "../lib/keypadConfigs";

export type ActionBarProps = {
  demoMode: boolean;
  connectedInfo: ConnectedInfo | null;
  devMode: boolean;
  hexDragOver: boolean;
  clientRef: MutableRefObject<BootloaderClient | null>;
  handleConnectClick: () => void;
  handleDemoToggle: () => void | Promise<void>;
  handleDisconnect: (reboot?: boolean) => Promise<void>;
  handleHexClick: () => void;
  handleHexDragOver: (event: DragEvent<HTMLButtonElement>) => void;
  handleHexDragLeave: (event: DragEvent<HTMLButtonElement>) => void;
  handleHexDrop: (event: DragEvent<HTMLButtonElement>) => void;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  onHexFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  compileAndFlash: () => Promise<void>;
  selectedLayout: DeviceLayoutDto | null;
  debugFirmware: boolean;
};

export function ActionBar(props: ActionBarProps) {
  const {
    demoMode,
    connectedInfo,
    devMode,
    hexDragOver,
    clientRef,
    handleConnectClick,
    handleDemoToggle,
    handleDisconnect,
    handleHexClick,
    handleHexDragOver,
    handleHexDragLeave,
    handleHexDrop,
    fileInputRef,
    onHexFileChange,
    compileAndFlash,
    selectedLayout,
    debugFirmware,
  } = props;

  return (
    <div className="actions">
      <button onClick={handleConnectClick} className="btn">Connect</button>
      {!demoMode && (
        <button
          onClick={handleDemoToggle}
          className="btn btn-demo"
          disabled={Boolean(connectedInfo)}
          title="Start demo mode to explore the UI without connecting a real device."
        >
          Start Demo
        </button>
      )}
      {connectedInfo && (
        <button onClick={() => void handleDisconnect(true)} className="btn">Disconnect</button>
      )}
      {devMode && (
        <>
          <button
            className={`btn${hexDragOver ? " btn-drop" : ""}`}
            disabled={!clientRef.current}
            onClick={handleHexClick}
            onDragOver={handleHexDragOver}
            onDragEnter={handleHexDragOver}
            onDragLeave={handleHexDragLeave}
            onDrop={handleHexDrop}
          >
            Upload .hex
          </button>
          <input ref={fileInputRef} type="file" accept=".hex,.ihx,.ihex,.txt" className="hidden" onChange={onHexFileChange} />
        </>
      )}
      <button onClick={compileAndFlash} className="btn btn-primary" disabled={!clientRef.current || (!selectedLayout && !debugFirmware)}>
        Compile & Flash
      </button>
    </div>
  );
}
