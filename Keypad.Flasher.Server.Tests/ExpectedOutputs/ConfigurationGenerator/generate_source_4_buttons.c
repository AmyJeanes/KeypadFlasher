#include "configuration.h"
#include "src/userUsbHidKeyboardMouse/USBHIDKeyboardMouse.h"

const button_binding_t button_bindings[] = {
    {
        .pin = 15,
        .active_low = true,
        .led_index = 0,
        .bootloader_on_boot = true,
        .bootloader_chord_member = true,
        .function = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .sequence = {'1'},
                .length = 1,
                .delay = 0
            }
        }
    },
    {
        .pin = 16,
        .active_low = true,
        .led_index = 1,
        .bootloader_on_boot = true,
        .bootloader_chord_member = true,
        .function = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .sequence = {'2'},
                .length = 1,
                .delay = 0
            }
        }
    },
    {
        .pin = 17,
        .active_low = true,
        .led_index = 2,
        .bootloader_on_boot = true,
        .bootloader_chord_member = true,
        .function = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .sequence = {'3'},
                .length = 1,
                .delay = 0
            }
        }
    },
    {
        .pin = 11,
        .active_low = true,
        .led_index = 3,
        .bootloader_on_boot = true,
        .bootloader_chord_member = true,
        .function = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .sequence = {'4'},
                .length = 1,
                .delay = 0
            }
        }
    }
};

const size_t button_binding_count = sizeof(button_bindings) / sizeof(button_bindings[0]);

const encoder_binding_t encoder_bindings[] = {
    {0}
};

const size_t encoder_binding_count = 0;
