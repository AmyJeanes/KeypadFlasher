#include "configuration.h"

#if !CONFIGURATION_DEBUG_MODE
#ifndef USER_USB_RAM
#error "Require USB RAM. Go Tools > USB Setting and pick the 2nd option in the dropdown list"
#endif
#endif

//app include
#include "src/debug_mode.h"
#if !CONFIGURATION_DEBUG_MODE
#if NEO_COUNT > 0
#include "src/neo/neo.h"
#endif
#include "src/userUsbHidKeyboardMouse/USBHIDKeyboardMouse.h"
#include "src/buttons.h"
#include "src/encoder.h"
#include "src/hid.h"
#include "src/led.h"
#include "src/util.h"
#endif

// ===================================================================================
// Main section
// ============================================================================
// Initialize pins
void setup()
{
#if CONFIGURATION_DEBUG_MODE
  debug_mode_setup();
#else
#if NEO_COUNT > 0
  // Initialize neopixels
  NEO_init();
  delay(10);
  NEO_clearAll();
#endif

  // Go in bootloader mode if the configured boot button is held during power-on
  if (configuration_bootloader_requested())
  {
#if NEO_COUNT > 0
    const uint8_t boot_hues[3] = {NEO_CYAN, NEO_BLUE, NEO_MAG};
    for (uint8_t i = 0; i < NEO_COUNT; ++i)
    {
      NEO_writeHue(i, boot_hues[i % 3], NEO_BRIGHT_KEYS);
    }
    NEO_update(); // update pixels
#endif
    BOOT_now();     // jump to bootloader
  }

  buttons_setup();
  encoder_setup();
  led_set_mode(LED_LOOP);
  USBInit();
#endif
}


//Main loop, read buttons
void loop()
{
#if CONFIGURATION_DEBUG_MODE
  debug_mode_loop();
#else
  //task update
  buttons_update();
  encoder_update();
  hid_service();
  led_update();

  // light idle to avoid saturating USB
  delay(1);
#endif
}
