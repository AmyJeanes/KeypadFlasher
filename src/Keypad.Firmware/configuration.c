// Sample configuration used to keep firmware buildable in the repo.
// At runtime this file is replaced by the backend configuration generator.

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
                .steps = {
                    {
                        .kind = HID_STEP_KEY,
                        .keycode = 'a',
                        .modifiers = 0,
                        .hold_ms = 10,
                        .gap_ms = 10,
                        .function_value = 1,
                        .pointer_type = 0,
                        .pointer_value = 0,
                        .functionPointer = 0
                    }
                },
                .length = 1
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
                .steps = {
                    {
                        .kind = HID_STEP_KEY,
                        .keycode = 'b',
                        .modifiers = 0,
                        .hold_ms = 10,
                        .gap_ms = 10,
                        .function_value = 1,
                        .pointer_type = 0,
                        .pointer_value = 0,
                        .functionPointer = 0
                    }
                },
                .length = 1
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
                .steps = {
                    {
                        .kind = HID_STEP_KEY,
                        .keycode = 'c',
                        .modifiers = 0,
                        .hold_ms = 10,
                        .gap_ms = 10,
                        .function_value = 1,
                        .pointer_type = 0,
                        .pointer_value = 0,
                        .functionPointer = 0
                    }
                },
                .length = 1
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
                .steps = {
                    {
                        .kind = HID_STEP_KEY,
                        .keycode = 'd',
                        .modifiers = 0,
                        .hold_ms = 10,
                        .gap_ms = 10,
                        .function_value = 1,
                        .pointer_type = 0,
                        .pointer_value = 0,
                        .functionPointer = 0
                    }
                },
                .length = 1
            }
        }
    }
};

const size_t button_binding_count = sizeof(button_bindings) / sizeof(button_bindings[0]);

const encoder_binding_t encoder_bindings[] = {
    {
        .pin_a = 31,
        .pin_b = 30,
        .clockwise = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .steps = {
                    {
                        .kind = HID_STEP_FUNCTION,
                        .keycode = 0,
                        .modifiers = 0,
                        .hold_ms = 0,
                        .gap_ms = 0,
                        .function_value = 1,
                        .pointer_type = 0,
                        .pointer_value = 0,
                        .functionPointer = hid_consumer_volume_up
                    }
                },
                .length = 1
            }
        },
        .counter_clockwise = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .steps = {
                    {
                        .kind = HID_STEP_FUNCTION,
                        .keycode = 0,
                        .modifiers = 0,
                        .hold_ms = 0,
                        .gap_ms = 0,
                        .function_value = 1,
                        .pointer_type = 0,
                        .pointer_value = 0,
                        .functionPointer = hid_consumer_volume_down
                    }
                },
                .length = 1
            }
        }
    }
};

const size_t encoder_binding_count = sizeof(encoder_bindings) / sizeof(encoder_bindings[0]);

static const led_passive_mode_t led_passive_modes[] = {
    LED_PASSIVE_RAINBOW,
    LED_PASSIVE_RAINBOW,
    LED_PASSIVE_RAINBOW
};
static const led_rgb_t led_passive_colors[] = {
    { .r = 255, .g = 0, .b = 0 },
    { .r = 255, .g = 255, .b = 0 },
    { .r = 0, .g = 255, .b = 0 }
};
static const led_active_mode_t led_active_modes[] = {
    LED_ACTIVE_SOLID,
    LED_ACTIVE_SOLID,
    LED_ACTIVE_SOLID
};
static const uint8_t led_rainbow_step_ms[] = { 20, 20, 20 };
static const uint8_t led_breathing_min_percent[] = { 20, 20, 20 };
static const uint8_t led_breathing_step_ms[] = { 20, 20, 20 };
static const led_rgb_t led_active_colors[] = {
    { .r = 255, .g = 255, .b = 255 },
    { .r = 255, .g = 255, .b = 255 },
    { .r = 255, .g = 255, .b = 255 }
};
const led_configuration_t led_configuration = {
    .passive_modes = led_passive_modes,
    .passive_colors = led_passive_colors,
    .active_modes = led_active_modes,
    .active_colors = led_active_colors,
    .count = 3,
    .brightness_percent = 100,
    .rainbow_step_ms = led_rainbow_step_ms,
    .breathing_min_percent = led_breathing_min_percent,
    .breathing_step_ms = led_breathing_step_ms
};