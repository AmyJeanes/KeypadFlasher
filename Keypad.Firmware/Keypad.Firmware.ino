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
    led_show_bootloader_indicator();
#endif
    BOOT_now();     // jump to bootloader
  }

  buttons_setup();
  encoder_setup();
#if NEO_COUNT > 0
  led_set_mode(LED_LOOP);
#endif
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
#if NEO_COUNT > 0
  led_update();
#endif

  // light idle to avoid saturating USB
  delay(1);
#endif
}
