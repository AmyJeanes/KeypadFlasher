#pragma once

#include <stdint.h>
#include <stddef.h>

typedef enum
{
  HID_TRIGGER_PRESS,
  HID_TRIGGER_RELEASE,
  HID_TRIGGER_CLICK,
} hid_trigger_mode_t;


typedef enum
{
  HID_POINTER_MOVE_UP,
  HID_POINTER_MOVE_DOWN,
  HID_POINTER_MOVE_LEFT,
  HID_POINTER_MOVE_RIGHT,
  HID_POINTER_LEFT_CLICK,
  HID_POINTER_RIGHT_CLICK,
  HID_POINTER_SCROLL_UP,
  HID_POINTER_SCROLL_DOWN
} hid_pointer_event_type_t;

typedef struct
{
  hid_pointer_event_type_t type;
  uint8_t value;
} hid_pointer_event_t;

typedef struct
{
  uint8_t sequence[100];
  uint8_t length;
  uint8_t delay;
} hid_key_sequence_t;

typedef enum
{
  HID_BINDING_SEQUENCE,
  HID_BINDING_MOUSE,
  HID_BINDING_FUNCTION,
  HID_BINDING_NULL,
} hid_binding_type_t;

typedef struct
{
  hid_pointer_event_t mouse_event_sequence[30];
  uint8_t length;
  uint8_t delay;
  uint8_t keypress;
} hid_mouse_macro_t;

typedef struct
{
  hid_binding_type_t type;
  union
  {
    hid_key_sequence_t sequence;
    hid_mouse_macro_t mouse;
    void (*functionPointer)(hid_trigger_mode_t mode);
  } function;
} hid_binding_t;


void hid_handle_button(size_t button_index, hid_trigger_mode_t mode);
void hid_handle_encoder(size_t encoder_index, bool clockwise);

void hid_consumer_volume_up(hid_trigger_mode_t mode);
void hid_consumer_volume_down(hid_trigger_mode_t mode);

void hid_service(void);
