#include "configuration.h"
#include "src/userUsbHidKeyboardMouse/USBHIDKeyboardMouse.h"

const button_binding_t button_bindings[] = {
    {
        .pin = 32,
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
                        .keycode = '0',
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
        .pin = 14,
        .active_low = true,
        .led_index = -1,
        .bootloader_on_boot = false,
        .bootloader_chord_member = true,
        .function = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .steps = {
                    {
                        .kind = HID_STEP_KEY,
                        .keycode = '1',
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
        .pin = 15,
        .active_low = true,
        .led_index = -1,
        .bootloader_on_boot = false,
        .bootloader_chord_member = true,
        .function = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .steps = {
                    {
                        .kind = HID_STEP_KEY,
                        .keycode = '2',
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
        .led_index = -1,
        .bootloader_on_boot = false,
        .bootloader_chord_member = true,
        .function = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .steps = {
                    {
                        .kind = HID_STEP_KEY,
                        .keycode = '3',
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
        .led_index = -1,
        .bootloader_on_boot = false,
        .bootloader_chord_member = true,
        .function = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .steps = {
                    {
                        .kind = HID_STEP_KEY,
                        .keycode = '4',
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
        .pin = 31,
        .active_low = true,
        .led_index = -1,
        .bootloader_on_boot = false,
        .bootloader_chord_member = true,
        .function = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .steps = {
                    {
                        .kind = HID_STEP_KEY,
                        .keycode = '5',
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
        .pin = 30,
        .active_low = true,
        .led_index = -1,
        .bootloader_on_boot = false,
        .bootloader_chord_member = true,
        .function = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .steps = {
                    {
                        .kind = HID_STEP_KEY,
                        .keycode = '6',
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
        .pin = 11,
        .active_low = true,
        .led_index = -1,
        .bootloader_on_boot = false,
        .bootloader_chord_member = true,
        .function = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .steps = {
                    {
                        .kind = HID_STEP_KEY,
                        .keycode = '7',
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
        .bootloader_on_boot = false,
        .bootloader_chord_member = true,
        .function = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .steps = {
                    {
                        .kind = HID_STEP_KEY,
                        .keycode = '8',
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
        .pin = 34,
        .active_low = true,
        .led_index = -1,
        .bootloader_on_boot = false,
        .bootloader_chord_member = true,
        .function = {
            .type = HID_BINDING_SEQUENCE,
            .function.sequence = {
                .steps = {
                    {
                        .kind = HID_STEP_KEY,
                        .keycode = '9',
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
    {0}
};

const size_t encoder_binding_count = 0;

const led_configuration_t led_configuration = {
    .count = 0,
    .brightness_percent = 0,
    .rainbow_step_ms = 0,
    .breathing_min_percent = 0,
    .breathing_step_ms = 0,
    .passive_modes = 0,
    .passive_colors = 0,
    .active_modes = 0,
    .active_colors = 0
};
