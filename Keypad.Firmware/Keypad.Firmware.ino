#ifndef USER_USB_RAM
#error "Require USB RAM. Go Tools > USB Setting and pick the 2nd option in the dropdown list"
#endif

//lib include
#include "src/neo/neo.h"
#include "src/userUsbHidKeyboardMouse/USBHIDKeyboardMouse.h"

//app include
#include "src/buttons.h"
#include "src/encoder.h"
#include "src/hid.h"
#include "src/led.h"
#include "src/util.h"
#include "configuration.h"
#define LED_PIN 34 // Pin for the LED strip, configure neo leds in src/neo/config.h




// ===================================================================================
// Main section
// ============================================================================
// Initialize pins
void setup()
{

  // Initialize neopixels
  NEO_init();
  delay(10);
  NEO_clearAll();

  // Go in bootloader mode if the configured boot button is held during power-on
  if (configuration_bootloader_requested())
  {
    const uint8_t boot_hues[3] = {NEO_CYAN, NEO_BLUE, NEO_MAG};
    for (uint8_t i = 0; i < NEO_COUNT; ++i)
    {
      NEO_writeHue(i, boot_hues[i % 3], NEO_BRIGHT_KEYS);
    }
    NEO_update(); // update pixels
    BOOT_now();     // jump to bootloader
  }

  buttons_setup();
  encoder_setup();
  led_set_mode(LED_LOOP);
  USBInit();
}


//Main loop, read buttons
void loop()
{

  //task update
  buttons_update();
  encoder_update();
  hid_service();
  led_update();

  // light idle to avoid saturating USB
  delay(1);
}
