// ===================================================================================
// Encoder section
// nice encoder tutorial: https://daniellethurow.com/blog/2021/8/30/how-to-use-quadrature-rotary-encoders
// ============================================================================

#include <Arduino.h>

#include "hid.h"
#include "configuration_data.h"

// lookup table for quadrature transitions (prev<<2 | current)
static const int8_t rotary_table_s[16] = {
    0, -1,  1, 0,
    1,  0,  0,-1,
   -1,  0,  0, 1,
    0,  1, -1, 0};

static uint8_t *encoder_prev_values_s = NULL;
static long *encoder_position_s = NULL;
static long *encoder_position_reported_s = NULL;
static size_t encoder_state_count_s = 0;
static size_t encoder_state_capacity_s = 0;

static void encoder_sample(size_t index)
{
    int valA = digitalRead(encoder_bindings[index].pin_a);
    int valB = digitalRead(encoder_bindings[index].pin_b);
    uint8_t new_val = (uint8_t)((valA << 1) | valB);
    uint8_t prev = encoder_prev_values_s[index];
    uint8_t combined = (uint8_t)((prev << 2) | new_val);
    encoder_prev_values_s[index] = new_val;
    encoder_position_s[index] += rotary_table_s[combined];
}

void encoder_setup(void)
{
    encoder_prev_values_s = configuration_encoder_prev_storage();
    encoder_position_s = configuration_encoder_position_storage();
    encoder_position_reported_s = configuration_encoder_reported_storage();
    encoder_state_capacity_s = configuration_encoder_state_capacity();

    if (encoder_binding_count == 0)
    {
        encoder_state_count_s = 0;
        return;
    }

    if (encoder_prev_values_s == NULL || encoder_position_s == NULL || encoder_position_reported_s == NULL || encoder_state_capacity_s == 0)
    {
        encoder_state_count_s = 0;
        return;
    }

    encoder_state_count_s = encoder_binding_count;
    if (encoder_state_count_s > encoder_state_capacity_s)
    {
        encoder_state_count_s = encoder_state_capacity_s;
    }

    for (size_t i = 0; i < encoder_state_count_s; ++i)
    {
        pinMode(encoder_bindings[i].pin_a, INPUT_PULLUP);
        pinMode(encoder_bindings[i].pin_b, INPUT_PULLUP);

        int valA = digitalRead(encoder_bindings[i].pin_a);
        int valB = digitalRead(encoder_bindings[i].pin_b);
        encoder_prev_values_s[i] = (uint8_t)((valA << 1) | valB);
        encoder_position_s[i] = 0;
        encoder_position_reported_s[i] = 0;
    }
}

void encoder_update(void)
{
    if (encoder_state_count_s == 0 || encoder_prev_values_s == NULL)
    {
        return;
    }

    for (size_t index = 0; index < encoder_state_count_s; ++index)
    {
        encoder_sample(index);
    }

    for (size_t index = 0; index < encoder_state_count_s; ++index)
    {
        while (encoder_position_s[index] - encoder_position_reported_s[index] >= 4)
        {
            encoder_position_reported_s[index] += 4;
            hid_handle_encoder(index, true);
        }

        while (encoder_position_s[index] - encoder_position_reported_s[index] <= -4)
        {
            encoder_position_reported_s[index] -= 4;
            hid_handle_encoder(index, false);
        }
    }
}