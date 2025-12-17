#include <Arduino.h>

#include "../configuration.h"

static bool button_state_storage_s[CONFIGURATION_BUTTON_CAPACITY];

size_t configuration_button_state_capacity(void)
{
    return CONFIGURATION_BUTTON_CAPACITY;
}

bool *configuration_button_state_storage(void)
{
    return button_state_storage_s;
}

static uint8_t encoder_prev_storage_s[CONFIGURATION_ENCODER_CAPACITY];
static long encoder_position_storage_s[CONFIGURATION_ENCODER_CAPACITY];
static long encoder_reported_storage_s[CONFIGURATION_ENCODER_CAPACITY];

size_t configuration_encoder_state_capacity(void)
{
    return CONFIGURATION_ENCODER_CAPACITY;
}

uint8_t *configuration_encoder_prev_storage(void)
{
    return encoder_prev_storage_s;
}

long *configuration_encoder_position_storage(void)
{
    return encoder_position_storage_s;
}

long *configuration_encoder_reported_storage(void)
{
    return encoder_reported_storage_s;
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
