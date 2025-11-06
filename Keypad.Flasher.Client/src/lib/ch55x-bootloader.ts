/// <reference types="w3c-web-usb" />

// ===== Helpers =====
const toHex = (n: number) => `0x${n.toString(16)}`;
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try { return JSON.stringify(err); } catch { return String(err); }
}

// ===== Types =====
export type ConnectedInfo = { version: string; id: number[]; deviceIdHex: string };
export type Progress = { phase: "" | "Writing" | "Verifying"; current: number; total: number };
export type ProgressCb = (p: Progress) => void;

// ===== Constants =====
const VENDOR_ID = 0x4348;
const PRODUCT_ID = 0x55e0;
const EMPTY_VALUE = 0xff;
const SUPPORTED_DEVICE_IDS = [0x51, 0x52, 0x54, 0x58, 0x59];

const bootloaderDetectCmd = new Uint8Array([
  0xa1, 0x12, 0x00, 0x00, 0x11, 0x4d, 0x43, 0x55, 0x20, 0x49, 0x53, 0x50, 0x20, 0x26, 0x20, 0x57, 0x43, 0x48,
  0x2e, 0x43, 0x4e,
]);
const bootloaderIDCmd = new Uint8Array([0xa7, 0x02, 0x00, 0x1f, 0x00]);
const bootloaderInitCmd = new Uint8Array([
  0xa8, 0x0e, 0x00, 0x07, 0x00, 0xff, 0xff, 0xff, 0xff, 0x03, 0x00, 0x00, 0x00, 0xff, 0x52, 0x00, 0x00,
]);
const bootloaderAddessCmd = new Uint8Array([
  0xa3, 0x1e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
const bootloaderEraseCmd = new Uint8Array([0xa4, 0x01, 0x00, 0x08]);
const bootloaderResetCmd = new Uint8Array([0xa2, 0x01, 0x00, 0x01]); // 0x00 not run, 0x01 run

function makeWriteCmdTemplate(): Uint8Array {
  const arr = new Uint8Array(64);
  arr[0] = 0xa5;
  arr[1] = 0x3d; // default length when payload is 56 bytes
  return arr;
}
function makeVerifyCmdTemplate(): Uint8Array {
  const arr = new Uint8Array(64);
  arr[0] = 0xa6;
  arr[1] = 0x3d; // default length when payload is 56 bytes
  return arr;
}

// ===== Intel HEX parsing (browser-safe) =====
// Record types
const DATA = 0, END_OF_FILE = 1, EXT_SEGMENT_ADDR = 2, START_SEGMENT_ADDR = 3, EXT_LINEAR_ADDR = 4, START_LINEAR_ADDR = 5;

export function parseIntelHexBrowser(data: string, bufferSize: number): {
  data: Uint8Array; startSegmentAddress: number | null; startLinearAddress: number | null;
} {
  let buf = new Uint8Array(bufferSize);
  buf.fill(EMPTY_VALUE);

  let bufLength = 0;
  let highAddress = 0;
  let startSegmentAddress: number | null = null;
  let startLinearAddress: number | null = null;
  let lineNum = 0;
  let pos = 0;

  const SMALLEST_LINE = 11;

  function ensureCapacity(minCapacity: number): void {
    if (minCapacity <= buf.length) return;
    const newLen = Math.max(minCapacity, buf.length * 2);
    const tmp = new Uint8Array(newLen);
    tmp.fill(EMPTY_VALUE);
    tmp.set(buf.subarray(0, bufLength), 0);
    buf = tmp;
  }

  while (pos + SMALLEST_LINE <= data.length) {
    if (data.charAt(pos++) !== ":") {
      throw new Error(`Line ${lineNum + 1} does not start with a colon (:).`);
    } else {
      lineNum++;
    }

    const dataLength = parseInt(data.substr(pos, 2), 16);
    pos += 2;

    const lowAddress = parseInt(data.substr(pos, 4), 16);
    pos += 4;

    const recordType = parseInt(data.substr(pos, 2), 16);
    pos += 2;

    const dataField = data.substr(pos, dataLength * 2);
    const dataFieldBuf = new Uint8Array(dataLength);
    for (let i = 0; i < dataLength; i++) {
      dataFieldBuf[i] = parseInt(dataField.substring(i * 2, i * 2 + 2), 16) & 0xff;
    }
    pos += dataLength * 2;

    const checksum = parseInt(data.substr(pos, 2), 16);
    pos += 2;

    let calcChecksum = (dataLength + (lowAddress >> 8) + lowAddress + recordType) & 0xff;
    for (let i = 0; i < dataLength; i++) calcChecksum = (calcChecksum + dataFieldBuf[i]) & 0xff;
    calcChecksum = (0x100 - calcChecksum) & 0xff;
    if (checksum !== calcChecksum) {
      throw new Error(`Invalid checksum on line ${lineNum}: got ${checksum}, expected ${calcChecksum}`);
    }

    switch (recordType) {
      case DATA: {
        const absoluteAddress = highAddress + lowAddress;
        ensureCapacity(absoluteAddress + dataLength);
        buf.set(dataFieldBuf, absoluteAddress);
        bufLength = Math.max(bufLength, absoluteAddress + dataLength);
        break;
      }
      case END_OF_FILE: {
        if (dataLength !== 0) throw new Error(`Invalid EOF record on line ${lineNum}.`);
        return { data: buf.slice(0, bufLength), startSegmentAddress, startLinearAddress };
      }
      case EXT_SEGMENT_ADDR: {
        if (dataLength !== 2 || lowAddress !== 0) throw new Error(`Invalid extended segment address on line ${lineNum}.`);
        highAddress = parseInt(dataField, 16) << 4;
        break;
      }
      case START_SEGMENT_ADDR: {
        if (dataLength !== 4 || lowAddress !== 0) throw new Error(`Invalid start segment address on line ${lineNum}.`);
        startSegmentAddress = parseInt(dataField, 16);
        break;
      }
      case EXT_LINEAR_ADDR: {
        if (dataLength !== 2 || lowAddress !== 0) throw new Error(`Invalid extended linear address on line ${lineNum}.`);
        highAddress = parseInt(dataField, 16) << 16;
        break;
      }
      case START_LINEAR_ADDR: {
        if (dataLength !== 4 || lowAddress !== 0) throw new Error(`Invalid start linear address on line ${lineNum}.`);
        startLinearAddress = parseInt(dataField, 16);
        break;
      }
      default:
        throw new Error(`Invalid record type (${recordType}) on line ${lineNum}`);
    }

    if (data.charAt(pos) === "\r") pos++;
    if (data.charAt(pos) === "\n") pos++;
  }

  throw new Error("Unexpected end of input: missing or invalid EOF record.");
}

// ===== Core class =====
export class CH55xBootloader {
  public uploadReady = false;
  public bootloaderDeviceID: number | null = null;
  private device: USBDevice | null = null;
  private interfaceNumber: number | null = null;
  private epIn: number | null = null;
  private epOut: number | null = null;
  private bootloaderMask: Uint8Array = new Uint8Array(8);
  private opts: { vendorId?: number; productId?: number };

  constructor(opts: { vendorId?: number; productId?: number } = {}) {
    this.opts = opts;
  }

  // ---- Static helpers ----
  static isWebUsbAvailable(): boolean {
    return Boolean((typeof navigator !== "undefined" && navigator.usb));
  }

  static requireSecureContext(): void {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      // Not throwing – but consumers can warn users that HTTPS is required.
      // WebUSB generally requires secure context.
    }
  }

  // ---- Public API ----
  async connect(): Promise<ConnectedInfo> {
    const webUsb: USB | undefined = (typeof navigator !== "undefined" ? navigator.usb : undefined);
    if (!webUsb) throw new Error("WebUSB not available in this browser.");

    const vendorId = this.opts.vendorId ?? VENDOR_ID;
    const productId = this.opts.productId ?? PRODUCT_ID;

    // Must be triggered by user gesture in most browsers.
    const device = await webUsb.requestDevice({ filters: [{ vendorId, productId }] });
    this.device = device;

    await device.open();
    if (device.configuration == null) await device.selectConfiguration(1);

    let interfaceNumber: number | null = null;
    let epIn: number | null = null;
    let epOut: number | null = null;

    for (const iface of device.configuration!.interfaces) {
      for (const alt of iface.alternates) {
        if (alt.interfaceClass === 0xff) {
          interfaceNumber = iface.interfaceNumber;
          for (const ep of alt.endpoints) {
            if (ep.direction === "in") epIn = ep.endpointNumber;
            if (ep.direction === "out") epOut = ep.endpointNumber;
          }
        }
      }
    }

    if (interfaceNumber == null || epIn == null || epOut == null) throw new Error("USB interface/endpoint not found.");

    this.interfaceNumber = interfaceNumber;
    this.epIn = epIn;
    this.epOut = epOut;

    await device.claimInterface(interfaceNumber);

    // Detect MCU
    await device.transferOut(epOut, bootloaderDetectCmd.buffer);
    let res = await device.transferIn(epIn, 64);
    let u = new Uint8Array(res.data!.buffer);
    const devId = u[4];
    const family = u[5];

    if (family !== 0x11) throw new Error("MCU family not supported");
    if (!SUPPORTED_DEVICE_IDS.includes(devId)) throw new Error(`Device not supported ${toHex(devId)}`);

    this.bootloaderDeviceID = devId;

    // Detect bootloader version & ID
    await device.transferOut(epOut, bootloaderIDCmd.buffer);
    res = await device.transferIn(epIn, 64);
    u = new Uint8Array(res.data!.buffer);

    const ver = `${u[19]}.${u[20]}.${u[21]}`;
    const verNum = u[19] * 100 + u[20] * 10 + u[21];
    if (verNum < 231 || verNum > 250) throw new Error(`Bootloader version not supported: ${ver}`);
    const id = [u[22], u[23], u[24], u[25]];

    // Build XOR mask
    const idSum = (id[0] + id[1] + id[2] + id[3]) & 0xff;
    const mask = new Uint8Array(8);
    for (let i = 0; i < 8; i++) mask[i] = idSum;
    mask[7] = (mask[7] + devId) & 0xff;
    this.bootloaderMask = mask;

    this.uploadReady = true;

    return { version: ver, id, deviceIdHex: toHex(devId) };
  }

  async flashIntelHexText(text: string, bufferSize = 63 * 1024, onProgress?: ProgressCb): Promise<void> {
    const { data } = parseIntelHexBrowser(text, bufferSize);
    return this.flashBinary(data, onProgress);
  }

  async flashBinary(hexBytes: Uint8Array, onProgress?: ProgressCb): Promise<void> {
    const device = this.device;
    const epIn = this.epIn;
    const epOut = this.epOut;

    if (!device || epIn == null || epOut == null) throw new Error("Connect bootloader first.");

    try {
      // init
      await device.transferOut(epOut, bootloaderInitCmd.buffer);
      await device.transferIn(epIn, 64);

      // re-detect (as original)
      await device.transferOut(epOut, bootloaderIDCmd.buffer);
      await device.transferIn(epIn, 64);

      // address 0
      await device.transferOut(epOut, bootloaderAddessCmd.buffer);
      await device.transferIn(epIn, 64);

      // erase
      await device.transferOut(epOut, bootloaderEraseCmd.buffer);
      await device.transferIn(epIn, 64);

      // write
      const writeDataSize = hexBytes.length;
      const totalPackets = Math.floor((writeDataSize + 55) / 56);
      const rem = writeDataSize % 56;
      const lastPacketSize = rem === 0 ? 56 : Math.ceil(rem / 8) * 8; // 8-byte aligned

      onProgress?.({ phase: "Writing", current: 0, total: totalPackets });

      for (let i = 0; i < totalPackets; i++) {
        const writeCmd = makeWriteCmdTemplate();
        const bytesThisPacket = (i < totalPackets - 1) ? 56 : lastPacketSize;

        for (let j = 0; j < bytesThisPacket; j++) {
          writeCmd[8 + j] = hexBytes[i * 56 + j] ?? EMPTY_VALUE;
        }

        // XOR mask over the actual number of 8-byte blocks
        const blocks = Math.ceil(bytesThisPacket / 8);
        for (let b = 0; b < blocks; b++) {
          for (let ii = 0; ii < 8 && (b * 8 + ii) < bytesThisPacket; ii++) {
            writeCmd[8 + b * 8 + ii] ^= this.bootloaderMask[ii];
          }
        }

        const addr = i * 56;
        writeCmd[1] = 61 - (56 - bytesThisPacket); // length field
        writeCmd[3] = addr & 0xff;
        writeCmd[4] = (addr >> 8) & 0xff;

        await device.transferOut(epOut, writeCmd.slice(0, writeCmd[1] + 3));
        await device.transferIn(epIn, 64);
        onProgress?.({ phase: "Writing", current: i + 1, total: totalPackets });
      }

      // verify
      onProgress?.({ phase: "Verifying", current: 0, total: totalPackets });
      for (let i = 0; i < totalPackets; i++) {
        const verifyCmd = makeVerifyCmdTemplate();
        const bytesThisPacket = (i < totalPackets - 1) ? 56 : lastPacketSize;

        for (let j = 0; j < bytesThisPacket; j++) {
          verifyCmd[8 + j] = hexBytes[i * 56 + j] ?? EMPTY_VALUE;
        }

        const blocks = Math.ceil(bytesThisPacket / 8);
        for (let b = 0; b < blocks; b++) {
          for (let ii = 0; ii < 8 && (b * 8 + ii) < bytesThisPacket; ii++) {
            verifyCmd[8 + b * 8 + ii] ^= this.bootloaderMask[ii];
          }
        }

        const addr = i * 56;
        verifyCmd[1] = 61 - (56 - bytesThisPacket);
        verifyCmd[3] = addr & 0xff;
        verifyCmd[4] = (addr >> 8) & 0xff;

        await device.transferOut(epOut, verifyCmd.slice(0, verifyCmd[1] + 3));
        const res = await device.transferIn(epIn, 64);
        const r = new Uint8Array(res.data!.buffer);
        if (r[4] !== 0 || r[5] !== 0) throw new Error(`Packet ${i + 1} does not match`);
        onProgress?.({ phase: "Verifying", current: i + 1, total: totalPackets });
      }

      await device.transferOut(epOut, bootloaderResetCmd.buffer);
      onProgress?.({ phase: "", current: 0, total: 0 });
    } catch (err) {
      throw new Error(errorMessage(err));
    }
  }

  async disconnect(): Promise<void> {
    if (!this.device) return;
    try {
      if (this.interfaceNumber != null) {
        try { await this.device.releaseInterface(this.interfaceNumber); } catch { throw new Error("Failed to release USB interface."); }
      }
      await this.device.close();
    } finally {
      this.device = null;
      this.interfaceNumber = null;
      this.epIn = null;
      this.epOut = null;
      this.uploadReady = false;
      this.bootloaderDeviceID = null;
      this.bootloaderMask = new Uint8Array(8);
    }
  }
}

// ===== Small utils for consumers =====
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

export const WebUsbMessages = {
  mustGesture: "Connecting must be triggered by a user gesture (click/tap).",
  noDeviceSelected: "No device selected.",
  notAvailable: "WebUSB not available in this browser.",
};

export function normalizeUsbErrorMessage(msg: string): string {
  if (msg.includes("Must be handling a user gesture")) return WebUsbMessages.mustGesture;
  if (msg.includes("No device selected")) return WebUsbMessages.noDeviceSelected;
  return msg;
}
