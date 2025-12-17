#include <Arduino.h>
#include "userUsbHidKeyboardMouse/USBHIDKeyboardMouse.h"
#include "led.h"
#include "hid.h"
#include "configuration_data.h"
#include "../configuration.h"

#if !CONFIGURATION_DEBUG_MODE

#define HID_CONSUMER_VOLUME_INCREMENT 0x00E9
#define HID_CONSUMER_VOLUME_DECREMENT 0x00EA

static int consumer_volume_pending_s = 0;
static uint8_t consumer_phase_s = 0; // 0 idle, 1 waiting to release

static void hid_run_key_sequence(hid_key_sequence_t sequence, hid_trigger_mode_t mode)
{
  if (mode == HID_TRIGGER_RELEASE)
  {
    return;
  }

  for (uint8_t i = 0; i < sequence.length; i++)
  {
    Keyboard_press(sequence.sequence[i]);
    delay(10);
    if (sequence.delay > 0)
    {
      Keyboard_release(sequence.sequence[i]);
      delay(sequence.delay);
    }
  }
  Keyboard_releaseAll();
}

static void hid_run_mouse_sequence(hid_mouse_macro_t sequence, hid_trigger_mode_t mode)
{
  if (mode == HID_TRIGGER_RELEASE)
  {
    return;
  }
  if (sequence.keypress > 0)
  {
    Keyboard_press(sequence.keypress);
    delay(30);
  }
  for (uint8_t i = 0; i < sequence.length; i++)
  {
    switch (sequence.mouse_event_sequence[i].type)
    {
    case HID_POINTER_MOVE_UP:
      Mouse_move(0, -sequence.mouse_event_sequence[i].value);
      break;
    case HID_POINTER_MOVE_DOWN:
      Mouse_move(0, sequence.mouse_event_sequence[i].value);
      break;
    case HID_POINTER_MOVE_LEFT:
      Mouse_move(-sequence.mouse_event_sequence[i].value, 0);
      break;
    case HID_POINTER_MOVE_RIGHT:
      Mouse_move(sequence.mouse_event_sequence[i].value, 0);
      break;
    case HID_POINTER_LEFT_CLICK:
      Mouse_click(MOUSE_LEFT);
      break;
    case HID_POINTER_RIGHT_CLICK:
      Mouse_click(MOUSE_RIGHT);
      break;
    case HID_POINTER_SCROLL_UP:
      Mouse_scroll(sequence.mouse_event_sequence[i].value);
      break;
    case HID_POINTER_SCROLL_DOWN:
      Mouse_scroll(-sequence.mouse_event_sequence[i].value);
      break;
    default:
      break;
    }
    if (sequence.keypress > 0)
    {
      Keyboard_releaseAll();
    }
    delay(sequence.delay);
  }
}

static void hid_run_binding(const hid_binding_t *binding, hid_trigger_mode_t mode)
{
  switch (binding->type)
  {
  case HID_BINDING_SEQUENCE:
    hid_run_key_sequence(binding->function.sequence, mode);
    break;
  case HID_BINDING_MOUSE:
    hid_run_mouse_sequence(binding->function.mouse, mode);
    break;
  case HID_BINDING_FUNCTION:
    binding->function.functionPointer(mode);
    break;
  case HID_BINDING_NULL:
  default:
    break;
  }
}

void hid_consumer_volume_up(hid_trigger_mode_t mode)
{
  if (mode != HID_TRIGGER_PRESS && mode != HID_TRIGGER_CLICK)
  {
    return;
  }
  consumer_volume_pending_s++;
}

void hid_consumer_volume_down(hid_trigger_mode_t mode)
{
  if (mode != HID_TRIGGER_PRESS && mode != HID_TRIGGER_CLICK)
  {
    return;
  }
  consumer_volume_pending_s--;
}

void hid_handle_button(size_t button_index, hid_trigger_mode_t mode)
{
  if (button_index >= button_binding_count)
  {
    return;
  }

  const button_binding_t *binding = &button_bindings[button_index];

#if NEO_COUNT > 0
  if (binding->led_index >= 0)
  {
    if (mode == HID_TRIGGER_PRESS)
    {
      led_presskey(binding->led_index);
    }
    else if (mode == HID_TRIGGER_RELEASE)
    {
      led_presskey(-1);
    }
  }
#endif

  hid_run_binding(&binding->function, mode);
}

void hid_handle_encoder(size_t encoder_index, bool clockwise)
{
  if (encoder_index >= encoder_binding_count)
  {
    return;
  }

  const encoder_binding_t *binding = &encoder_bindings[encoder_index];
  const hid_binding_t *fn = clockwise ? &binding->clockwise : &binding->counter_clockwise;
  hid_run_binding(fn, HID_TRIGGER_CLICK);
}

void hid_service(void)
{
  if (consumer_phase_s == 1)
  {
    if (Keyboard_consumer_try_send(0))
    {
      consumer_phase_s = 0;
    }
    return;
  }

  if (consumer_volume_pending_s > 0)
  {
    if (Keyboard_consumer_try_send(HID_CONSUMER_VOLUME_INCREMENT))
    {
      consumer_volume_pending_s--;
      consumer_phase_s = 1;
    }
  }
  else if (consumer_volume_pending_s < 0)
  {
    if (Keyboard_consumer_try_send(HID_CONSUMER_VOLUME_DECREMENT))
    {
      consumer_volume_pending_s++;
      consumer_phase_s = 1;
    }
  }
}

#endif
