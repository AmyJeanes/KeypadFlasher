#include <Arduino.h>

#include "configuration.h"
#include "src/userUsbHidKeyboardMouse/USBHIDKeyboardMouse.h"

const button_binding_t button_bindings[] = {
    {
        .pin = 11,
        .active_low = true,
        .led_index = 0,
        .bootloader_on_boot = false,
        .bootloader_chord_member = true,
        .function = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .sequence = {'a'},
                .length = 1,
                .delay = 0
            }
        }
    },
    {
        .pin = 17,
        .active_low = true,
        .led_index = 1,
        .bootloader_on_boot = false,
        .bootloader_chord_member = true,
        .function = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .sequence = {'b'},
                .length = 1,
                .delay = 0
            }
        }
    },
    {
        .pin = 16,
        .active_low = true,
        .led_index = 2,
        .bootloader_on_boot = false,
        .bootloader_chord_member = true,
        .function = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .sequence = {'c'},
                .length = 1,
                .delay = 0
            }
        }
    },
    {
        .pin = 33,
        .active_low = true,
        .led_index = -1,
        .bootloader_on_boot = true,
        .bootloader_chord_member = true,
        .function = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .sequence = {'d'},
                .length = 1,
                .delay = 0
            }
        }
    }
};

const size_t button_binding_count = sizeof(button_bindings) / sizeof(button_bindings[0]);

static bool button_state_storage[sizeof(button_bindings) / sizeof(button_bindings[0])];

size_t configuration_button_state_capacity(void)
{
    return sizeof(button_state_storage) / sizeof(button_state_storage[0]);
}

bool *configuration_button_state_storage(void)
{
    return button_state_storage;
}

const encoder_binding_t encoder_bindings[] = {
    {
        .pin_a = 31,
        .pin_b = 30,
        .clockwise = {
            .type = HID_BINDING_FUNCTION,
            .function.functionPointer = hid_consumer_volume_up
        },
        .counter_clockwise = {
            .type = HID_BINDING_FUNCTION,
            .function.functionPointer = hid_consumer_volume_down
        }
    }
};

const size_t encoder_binding_count = sizeof(encoder_bindings) / sizeof(encoder_bindings[0]);

static uint8_t encoder_prev_storage[sizeof(encoder_bindings) / sizeof(encoder_bindings[0])];
static long encoder_position_storage[sizeof(encoder_bindings) / sizeof(encoder_bindings[0])];
static long encoder_reported_storage[sizeof(encoder_bindings) / sizeof(encoder_bindings[0])];

size_t configuration_encoder_state_capacity(void)
{
    return sizeof(encoder_prev_storage) / sizeof(encoder_prev_storage[0]);
}

uint8_t *configuration_encoder_prev_storage(void)
{
    return encoder_prev_storage;
}

long *configuration_encoder_position_storage(void)
{
    return encoder_position_storage;
}

long *configuration_encoder_reported_storage(void)
{
    return encoder_reported_storage;
}

bool configuration_bootloader_requested(void)
{
    bool requested = false;
    for (size_t i = 0; i < button_binding_count; ++i)
    {
        if (!button_bindings[i].bootloader_on_boot)
        {
            continue;
        }

        pinMode(button_bindings[i].pin, button_bindings[i].active_low ? INPUT_PULLUP : INPUT);
        bool active = button_bindings[i].active_low ? !digitalRead(button_bindings[i].pin)
                                                    : digitalRead(button_bindings[i].pin);
        if (active)
        {
            requested = true;
            break;
        }
    }
    return requested;
}