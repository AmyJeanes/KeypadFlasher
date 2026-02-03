# Development

If you would like to contribute to the development of this project, please find instructions below on how to build the project from source as well as how to add support for new keypads.

## Building from source

To build and run the project from source, you will need:
- Visual Studio Code
- .NET 10 SDK
- Node.js v22+
- Arduino IDE with arduino-cli installed and on the system PATH

First time setup:
```bash
arduino-cli core install CH55xDuino:mcs51
git clone https://github.com/AmyJeanes/KeypadFlasher
cd KeypadFlasher/src/Keypad.Flasher.Client
npm install
```

Compile device firmware manually:
```bash
cd src/Keypad.Firmware
arduino-cli compile --fqbn CH55xDuino:mcs51:ch552:usb_settings=user148,clock=16internal --export-binaries
```

You can also configure the Arduino IDE and use that to compile and upload the firmware if you prefer a GUI:
- Open Arduino IDE
- Open the `src/Keypad.Firmware/Keypad.Firmware.ino` project
- Select the board "CH55xDuino" on Tools > Board
- Select "P3.6 (D+) Pull up" on Tools -> Bootloader
- Select "16MHz Internal 3.5V or 5V" on Tools -> Clock
- Select "USB" on Tools -> Upload method
- Select "USER CODE w/148B USB RAM" on Tools -> USB Settings
- Compile the project
- Connect the device in bootloader mode
- Upload the firmware (note: original firmware will be lost!)

Run the web app locally:
```
dotnet run --project src/Keypad.Flasher.Server
```

or

Build and run docker image:
```
docker build -t keypad -f ./src/Keypad.Flasher.Server/Dockerfile ./src
docker run -p 54196:8080 --rm -it -m 256MB keypad
```

If the browser does not open automatically, open a Chromium-based browser and navigate to `http://localhost:54196`

## Adding support for new keypads

- Connect the keypad in bootloader mode with the web app. Turn on Development mode to see the bootloader ID in the detected device card (e.g. `Bootloader 2.31 · ID 126, 80, 44, 189`). Copy those four numbers.
- Turn on **Debug firmware (USB CDC)** in the app and click **Compile & Flash**. Debug firmware works without a known config and exposes a USB serial port; it prints a banner, per-pin snapshots, and a 1s summary so you can see which pins change when you press buttons or rotate the encoder.
- Open a serial terminal to the new USB CDC device (baud rate does not matter) and press buttons/rotate the knob. Notes from the log:
  - Pins are labelled `P<port>.<bit>` (e.g. `P3.2` for pin `32`).
  - `active_low` means the signal reads low when pressed; `active` shows whether the firmware considers the input asserted.
  - Lines marked `configured` came from an existing config; unmarked lines help you find unused pins.
- Add an entry keyed by the bootloader ID to [src/Keypad.Flasher.Client/src/lib/keypad-configs.ts](src/Keypad.Flasher.Client/src/lib/keypad-configs.ts). Provide a friendly `name`, fill `buttons` with pin numbers, `activeLow`, optional `ledIndex`, `bootloaderOnBoot`, and `bootloaderChordMember`, add any `encoders`, and set `neoPixelPin` (or `-1` if none). Example:

```ts
"126-80-44-189": {
  name: "3 Keys 1 Knob",
  config: {
    buttons: [
      { pin: 33, activeLow: true, ledIndex: -1, bootloaderOnBoot: true, bootloaderChordMember: false, function: { type: "Sequence", sequence: "enter", delay: 5 } },
    ],
    encoders: [
      { pinA: 31, pinB: 30, clockwise: { type: "Function", functionPointer: "hid_consumer_volume_up" }, counterClockwise: { type: "Function", functionPointer: "hid_consumer_volume_down" } },
    ],
    neoPixelPin: 34,
  },
},
```

- Reflash without the debug checkbox to validate the mapping, then open a PR adding the new config so others can use it.