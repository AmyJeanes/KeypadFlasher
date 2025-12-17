#pragma once

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#include "hid.h"

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
long *configuration_encoder_position_storage(void);
long *configuration_encoder_reported_storage(void);

bool configuration_bootloader_requested(void);
