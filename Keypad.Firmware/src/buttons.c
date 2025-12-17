#include <Arduino.h>
#include "hid.h"
#include "util.h"
#include "buttons.h"
#include "configuration_data.h"

static bool *button_state_s = NULL;
static size_t button_state_capacity_s = 0;
static size_t button_state_count_s = 0;

void buttons_setup(void)
{
    button_state_s = configuration_button_state_storage();
    button_state_capacity_s = configuration_button_state_capacity();

    if (button_binding_count == 0)
    {
        button_state_count_s = 0;
        return;
    }

    if (button_state_s == NULL || button_state_capacity_s == 0)
    {
        button_state_count_s = 0;
        return;
    }

    button_state_count_s = button_binding_count;
    if (button_state_count_s > button_state_capacity_s)
    {
        button_state_count_s = button_state_capacity_s;
    }

    for (size_t i = 0; i < button_state_count_s; ++i)
    {
        pinMode(button_bindings[i].pin, button_bindings[i].active_low ? INPUT_PULLUP : INPUT);
        bool active = button_bindings[i].active_low ? !digitalRead(button_bindings[i].pin)
                                                   : digitalRead(button_bindings[i].pin);
        button_state_s[i] = active;
        if (active)
        {
            hid_handle_button(i, HID_TRIGGER_PRESS);
        }
    }
}

void buttons_update(void)
{
    if (button_state_count_s == 0 || button_state_s == NULL)
    {
        return;
    }

    bool has_bootloader_chord = false;
    bool bootloader_chord_candidate = true;

    for (size_t i = 0; i < button_state_count_s; ++i)
    {
        bool active = button_bindings[i].active_low ? !digitalRead(button_bindings[i].pin)
                                                   : digitalRead(button_bindings[i].pin);
        if (button_bindings[i].bootloader_chord_member)
        {
            has_bootloader_chord = true;
            bootloader_chord_candidate &= active;
        }

        if (button_state_s[i] != active)
        {
            hid_handle_button(i, active ? HID_TRIGGER_PRESS : HID_TRIGGER_RELEASE);
            button_state_s[i] = active;
        }

        if (button_bindings[i].function.type == HID_BINDING_FUNCTION && button_state_s[i] && !active)
        {
            hid_handle_button(i, HID_TRIGGER_CLICK);
        }
    }

    if (has_bootloader_chord && bootloader_chord_candidate)
    {
        BOOT_now();
    }
}