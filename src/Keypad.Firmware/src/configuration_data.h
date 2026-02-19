#pragma once

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#include "hid.h"

// Simple RGB container for LED config
typedef struct
{
    uint8_t r;
    uint8_t g;
    uint8_t b;
} led_rgb_t;

typedef enum
{
    LED_PASSIVE_OFF = 0,
    LED_PASSIVE_RAINBOW = 1,
    LED_PASSIVE_STATIC = 2,
    LED_PASSIVE_BREATHING = 3
} led_passive_mode_t;

typedef enum
{
    LED_ACTIVE_OFF = 0,
    LED_ACTIVE_SOLID = 1,
    LED_ACTIVE_NOTHING = 2
} led_active_mode_t;

typedef struct
{
    uint8_t count;
    uint8_t brightness_percent;
    const uint8_t *rainbow_step_ms;
    const uint8_t *breathing_min_percent;
    const uint8_t *breathing_step_ms;
    const led_passive_mode_t *passive_modes;
    const led_rgb_t *passive_colors;
    const led_active_mode_t *active_modes;
    const led_rgb_t *active_colors;
} led_configuration_t;

extern const led_configuration_t led_configuration;

typedef struct
{
    uint8_t pin;
    bool active_low;
    int8_t led_index;             // -1 when no LED mapping
    bool bootloader_on_boot;      // check during power-on to jump directly
    bool bootloader_chord_member; // contributes to in-field boot chord
    hid_binding_t function;
} button_binding_t;

typedef struct
{
    uint8_t pin_a;
    uint8_t pin_b;
    hid_binding_t clockwise;
    hid_binding_t counter_clockwise;
} encoder_binding_t;

extern const button_binding_t button_bindings[];
extern const size_t button_binding_count;

extern const encoder_binding_t encoder_bindings[];
extern const size_t encoder_binding_count;

size_t configuration_button_state_capacity(void);
bool *configuration_button_state_storage(void);

size_t configuration_encoder_state_capacity(void);
uint8_t *configuration_encoder_prev_storage(void);
int8_t *configuration_encoder_delta_storage(void);

bool configuration_bootloader_requested(void);
