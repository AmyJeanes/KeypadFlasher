#include <Arduino.h>
#include <stdbool.h>
#include "../configuration.h"
#include "led.h"

#if !CONFIGURATION_DEBUG_MODE && NEO_COUNT > 0
#ifndef NEO_REVERSED
#define NEO_REVERSED 0
#endif
#include "neo/neo.h"

static const led_configuration_t *led_cfg_s = &led_configuration;
static bool pressed_s[NEO_COUNT] = {0};      // pressed state per logical LED
static const uint8_t LED_RAINBOW_DEFAULT_STEP_MS = 20;
static const uint8_t LED_BREATH_DEFAULT_STEP_MS = 20;
static uint32_t last_rainbow_step_ms_s[NEO_COUNT] = {0};
static uint8_t rainbow_phase_s[NEO_COUNT] = {0};
static uint32_t last_breath_step_ms_s[NEO_COUNT] = {0};
static uint8_t breath_percent_s[NEO_COUNT] = {0}; // 0..100%
static bool breath_descending_s[NEO_COUNT] = {0};

static uint8_t led_count(void)
{
  return led_cfg_s->count;
}

static uint8_t clamp_percent(uint8_t value)
{
  return value > 100 ? 100 : value;
}

static uint8_t brightness_percent(void)
{
  return clamp_percent(led_cfg_s->brightness_percent);
}

static uint8_t rainbow_step_ms_for(uint8_t led)
{
  if (led_cfg_s->rainbow_step_ms == 0)
  {
    return LED_RAINBOW_DEFAULT_STEP_MS;
  }
  const uint8_t configured = led_cfg_s->rainbow_step_ms[led];
  return configured == 0 ? LED_RAINBOW_DEFAULT_STEP_MS : configured;
}

static uint8_t breathing_min_percent_for(uint8_t led)
{
  if (led_cfg_s->breathing_min_percent == 0)
  {
    return 0;
  }
  const uint8_t configured = led_cfg_s->breathing_min_percent[led];
  return clamp_percent(configured);
}

static uint8_t breathing_step_ms_for(uint8_t led)
{
  if (led_cfg_s->breathing_step_ms == 0)
  {
    return LED_BREATH_DEFAULT_STEP_MS;
  }
  const uint8_t configured = led_cfg_s->breathing_step_ms[led];
  return configured == 0 ? LED_BREATH_DEFAULT_STEP_MS : configured;
}

static void hue_to_rgb(uint8_t hue, led_rgb_t *out)
{
  // Match the original hue mapping used by NEO_writeHue with NEO_BRIGHT_KEYS brightness.
  const uint8_t phase = hue >> 6;
  const uint8_t step = (uint8_t)((hue & 63) << NEO_BRIGHT_KEYS);
  const uint8_t nstep = (uint8_t)((63 << NEO_BRIGHT_KEYS) - step);
  switch (phase)
  {
  case 0:
    out->r = nstep;
    out->g = step;
    out->b = 0;
    break;
  case 1:
    out->r = 0;
    out->g = nstep;
    out->b = step;
    break;
  case 2:
  default:
    out->r = step;
    out->g = 0;
    out->b = nstep;
    break;
  }
}

static uint8_t scale_component(uint8_t value, uint8_t percent)
{
  return (uint8_t)(((uint16_t)value * percent) / 100);
}

static void scale_color(const led_rgb_t *color, uint8_t percent, led_rgb_t *out)
{
  out->r = scale_component(color->r, percent);
  out->g = scale_component(color->g, percent);
  out->b = scale_component(color->b, percent);
}

static void write_scaled_color(uint8_t physical, const led_rgb_t *color, uint8_t percent)
{
  const uint8_t global_percent = brightness_percent();
  const uint8_t effective = (uint8_t)(((uint16_t)percent * global_percent) / 100);
  led_rgb_t scaled;
  scale_color(color, effective, &scaled);
  NEO_writeColor(physical, scaled.r, scaled.g, scaled.b);
}

static led_passive_mode_t passive_mode_for(uint8_t led)
{
  if (led >= led_cfg_s->count || led_cfg_s->passive_modes == 0)
  {
    return LED_PASSIVE_OFF;
  }
  return led_cfg_s->passive_modes[led];
}

static uint8_t led_physical_index(uint8_t logical)
{
  // Map logical LED ordering to physical wiring when reversed.
  return NEO_REVERSED ? (uint8_t)(NEO_COUNT - 1 - logical) : logical;
}

void led_show_bootloader_indicator(void)
{
  const uint8_t count = led_count();
  for (uint8_t i = 0; i < count; ++i)
  {
    const uint8_t physical = led_physical_index(i);
    NEO_writeHue(physical, NEO_BLUE, NEO_BRIGHT_KEYS);
  }
  NEO_update();
}

void led_init(void)
{
  const uint32_t now = millis();
  const uint8_t count = led_count();
  for (uint8_t i = 0; i < count; ++i)
  {
    rainbow_phase_s[i] = (uint8_t)((i * 8) % 192); // start spread across hue wheel
    last_rainbow_step_ms_s[i] = now;
    last_breath_step_ms_s[i] = now;
    breath_percent_s[i] = 100;
    breath_descending_s[i] = true;
  }
}

void led_set_key_state(int key, bool pressed)
{
  const uint8_t count = led_count();
  if (key < 0 || key >= (int)count)
  {
    return;
  }
  pressed_s[key] = pressed;
}

void led_update()
{
  const uint8_t count = led_count();
  const uint32_t now = millis();
  for (uint8_t led = 0; led < count; ++led)
  {
    const led_passive_mode_t passive_mode = passive_mode_for(led);

    if (passive_mode == LED_PASSIVE_RAINBOW)
    {
      const uint8_t step_ms = rainbow_step_ms_for(led);
      const uint16_t elapsed = (uint16_t)(now - last_rainbow_step_ms_s[led]);
      if (elapsed >= step_ms)
      {
        uint16_t remaining = elapsed;
        uint8_t steps = 0;
        while (remaining >= step_ms && steps < 64)
        {
          remaining -= step_ms;
          steps++;
        }
        last_rainbow_step_ms_s[led] = now - remaining;
        uint16_t phase = (uint16_t)rainbow_phase_s[led] + steps;
        while (phase >= 192)
        {
          phase -= 192;
        }
        rainbow_phase_s[led] = (uint8_t)phase;
      }
    }

    if (passive_mode == LED_PASSIVE_BREATHING)
    {
      const uint8_t step_ms = breathing_step_ms_for(led);
      const uint16_t elapsed = (uint16_t)(now - last_breath_step_ms_s[led]);
      if (elapsed >= step_ms)
      {
        uint16_t remaining_ms = elapsed;
        uint8_t steps = 0;
        while (remaining_ms >= step_ms && steps < 200)
        {
          remaining_ms -= step_ms;
          steps++;
        }
        last_breath_step_ms_s[led] = now - remaining_ms;
        const uint8_t min_percent = breathing_min_percent_for(led);
        while (steps > 0)
        {
          if (breath_descending_s[led])
          {
            if (breath_percent_s[led] > min_percent)
            {
              breath_percent_s[led] -= 1;
            }
            else
            {
              breath_descending_s[led] = false;
            }
          }
          else
          {
            if (breath_percent_s[led] < 100)
            {
              breath_percent_s[led] += 1;
            }
            else
            {
              breath_descending_s[led] = true;
            }
          }
          steps--;
        }
      }
    }

    const uint8_t physical = led_physical_index(led);
    if (pressed_s[led])
    {
      const led_active_mode_t mode = led_cfg_s->active_modes[led];
      if (mode == LED_ACTIVE_SOLID)
      {
        const led_rgb_t *color = &led_cfg_s->active_colors[led];
        write_scaled_color(physical, color, 100);
        continue;
      }
      if (mode == LED_ACTIVE_OFF)
      {
        NEO_writeColor(physical, 0, 0, 0);
        continue;
      }
      // LED_ACTIVE_NOTHING falls through to passive rendering
    }

    switch (passive_mode)
    {
    case LED_PASSIVE_OFF:
      NEO_writeColor(physical, 0, 0, 0);
      break;
    case LED_PASSIVE_STATIC:
      {
        const led_rgb_t *color = &led_cfg_s->passive_colors[led];
        write_scaled_color(physical, color, 100);
      }
      break;
    case LED_PASSIVE_BREATHING:
      {
        const led_rgb_t *color = &led_cfg_s->passive_colors[led];
        write_scaled_color(physical, color, breath_percent_s[led]);
      }
      break;
    case LED_PASSIVE_RAINBOW:
    default:
      {
        const uint8_t hue = rainbow_phase_s[led];
        led_rgb_t hue_color;
        hue_to_rgb(hue, &hue_color);
        write_scaled_color(physical, &hue_color, 100);
      }
      break;
    }
  }

  NEO_update();
}
#endif