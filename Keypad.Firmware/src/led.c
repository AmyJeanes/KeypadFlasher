#include <Arduino.h>
#include "../configuration.h"
#include "led.h"

#if !CONFIGURATION_DEBUG_MODE

#if NEO_COUNT > 0
#include "neo/neo.h"

static enum led_keyboard_mode_t led_mode_s = LED_LOOP;
static int color_hue_s[NEO_COUNT] = {0}; // hue value: 0..191 color map
static int current_led_s = -1;           // current lit led index
static const uint8_t LED_LOOP_STEP_INTERVAL_MS = 20;
static uint32_t last_loop_step_ms_s = 0;

void led_set_color_hue(uint8_t led0, uint8_t led1, uint8_t led2)
{
  const uint8_t hues[3] = {led0, led1, led2};
  for (uint8_t i = 0; i < NEO_COUNT; ++i)
  {
    color_hue_s[i] = hues[i % 3];
  }
}

void led_set_mode(enum led_keyboard_mode_t mode)
{
  led_mode_s = mode;
  switch (mode)
  {
  case LED_LOOP:
    {
      const uint8_t hues[3] = {NEO_RED, NEO_YEL, NEO_GREEN};
      for (uint8_t i = 0; i < NEO_COUNT; ++i)
      {
        color_hue_s[i] = hues[i % 3];
      }
    }
    last_loop_step_ms_s = millis();
    break;
  }
}

// if in loop mode, change color to pressed key
void led_presskey(int key)
{
  if (key < 0 || key >= NEO_COUNT)
  {
    current_led_s = -1;
    return;
  }
  current_led_s = key;
}

void led_update()
{
  if (led_mode_s == LED_LOOP)
  {
    const uint32_t now = millis();
    if ((uint32_t)(now - last_loop_step_ms_s) >= LED_LOOP_STEP_INTERVAL_MS)
    {
      last_loop_step_ms_s = now;
      for (uint8_t i = 0; i < NEO_COUNT; ++i)
      {
        color_hue_s[i] += 1;
        if (color_hue_s[i] > 191)
        {
          color_hue_s[i] = 0;
        }
      }
    }
  }
  for (uint8_t led = 0; led < NEO_COUNT; ++led)
  {
    if (current_led_s == (int)led)
    {
      NEO_writeColor(led, 255, 255, 255);
    }
    else
    {
      NEO_writeHue(led, color_hue_s[led], NEO_BRIGHT_KEYS);
    }
  }

  NEO_update();
}

#else

void led_set_color_hue(uint8_t led0, uint8_t led1, uint8_t led2)
{
  (void)led0;
  (void)led1;
  (void)led2;
}

void led_set_mode(enum led_keyboard_mode_t mode)
{
  (void)mode;
}

void led_presskey(int key)
{
  (void)key;
}

void led_update()
{
}

#endif

#endif