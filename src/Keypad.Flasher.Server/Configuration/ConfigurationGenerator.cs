using System.Text;
using System.Linq;

namespace Keypad.Flasher.Server.Configuration
{
    public class ConfigurationGenerator
    {
        public string GenerateHeader(ConfigurationDefinition configuration)
        {
            var neoPixelCount = CalculateNeoPixelCount(configuration.Buttons);
            var neoPixelReversed = neoPixelCount > 0 && configuration.NeoPixelReversed;
            var maxKeySteps = Math.Max(1, CalculateMaxKeySteps(configuration));
            var sb = new StringBuilder();
            sb.AppendLine("// This file is auto-generated. Do not edit manually.");
            sb.AppendLine();
            sb.AppendLine("#pragma once");
            sb.AppendLine();
            sb.AppendLine("#include \"src/configuration_data.h\"");
            sb.AppendLine();
            sb.AppendLine($"#define CONFIGURATION_BUTTON_CAPACITY {configuration.Buttons.Count}");
            sb.AppendLine($"#define CONFIGURATION_ENCODER_CAPACITY {configuration.Encoders.Count}");
            sb.AppendLine($"#define CONFIGURATION_DEBUG_MODE {ToCInteger(configuration.DebugMode)}");
            sb.AppendLine($"#define DEBUG_NOISE_FILTER_ENABLED {ToCInteger(configuration.DebugOptions.EnableNoiseFilter)}");
            sb.AppendLine($"#define DEBUG_PULLUPS_ENABLED {ToCInteger(configuration.DebugOptions.EnablePullups)}");
            sb.AppendLine($"#define DEBUG_CONFIRM_SAMPLES {configuration.DebugOptions.ConfirmSamples}");
            sb.AppendLine($"#define DEBUG_CONFIRM_DELAY_MS {configuration.DebugOptions.ConfirmDelayMs}");
            sb.AppendLine($"#define HID_MAX_KEY_STEPS {maxKeySteps}");
            sb.AppendLine();
            if (neoPixelCount > 0)
            {
                if (configuration.NeoPixelPin < 0)
                {
                    throw new ArgumentOutOfRangeException(nameof(configuration), "NeoPixel pin must be non-negative when LEDs are configured.");
                }

                var neoPixelPinMacro = $"P{configuration.NeoPixelPin}";
                sb.AppendLine($"#define PIN_NEO {neoPixelPinMacro}");
                sb.AppendLine($"#define NEO_COUNT {neoPixelCount}");
                sb.AppendLine("#define NEO_GRB");
                sb.AppendLine($"#define NEO_REVERSED {ToCInteger(neoPixelReversed)}");
            }
            else
            {
                sb.AppendLine("#define NEO_COUNT 0");
                sb.AppendLine("#define NEO_REVERSED 0");
            }
            return sb.ToString();
        }

        public string GenerateSource(ConfigurationDefinition configuration)
        {
            var sb = new StringBuilder();
            var neoPixelCount = CalculateNeoPixelCount(configuration.Buttons);
            sb.AppendLine("#include \"configuration.h\"");
            sb.AppendLine("#include \"src/userUsbHidKeyboardMouse/USBHIDKeyboardMouse.h\"");
            sb.AppendLine();
            AppendButtonBindings(sb, configuration.Buttons, configuration.DebugMode);
            sb.AppendLine();
            AppendButtonCount(sb, configuration.Buttons);
            sb.AppendLine();
            AppendEncoderBindings(sb, configuration.Encoders, configuration.DebugMode);
            sb.AppendLine();
            AppendEncoderCount(sb, configuration.Encoders);
            sb.AppendLine();
            AppendLedConfiguration(sb, configuration, neoPixelCount);
            return sb.ToString();
        }

        private static void AppendButtonBindings(StringBuilder sb, IReadOnlyList<ButtonBinding> buttons, bool debugMode)
        {
            if (buttons.Count == 0)
            {
                sb.AppendLine("const button_binding_t button_bindings[] = {");
                AppendLine(sb, 1, "{0}");
                sb.AppendLine("};");
                return;
            }

            sb.AppendLine("const button_binding_t button_bindings[] = {");
            for (int i = 0; i < buttons.Count; i++)
            {
                AppendButton(sb, buttons[i], i == buttons.Count - 1, debugMode);
            }
            sb.AppendLine("};");
        }

        private static void AppendButtonCount(StringBuilder sb, IReadOnlyCollection<ButtonBinding> buttons)
        {
            if (buttons.Count == 0)
            {
                sb.AppendLine("const size_t button_binding_count = 0;");
                return;
            }

            sb.AppendLine("const size_t button_binding_count = sizeof(button_bindings) / sizeof(button_bindings[0]);");
        }

        private static void AppendEncoderBindings(StringBuilder sb, IReadOnlyList<EncoderBinding> encoders, bool debugMode)
        {
            if (encoders.Count == 0)
            {
                sb.AppendLine("const encoder_binding_t encoder_bindings[] = {");
                AppendLine(sb, 1, "{0}");
                sb.AppendLine("};");
                return;
            }

            sb.AppendLine("const encoder_binding_t encoder_bindings[] = {");
            for (int i = 0; i < encoders.Count; i++)
            {
                AppendEncoder(sb, encoders[i], i == encoders.Count - 1, debugMode);
            }
            sb.AppendLine("};");
        }

        private static void AppendEncoderCount(StringBuilder sb, IReadOnlyCollection<EncoderBinding> encoders)
        {
            if (encoders.Count == 0)
            {
                sb.AppendLine("const size_t encoder_binding_count = 0;");
                return;
            }

            sb.AppendLine("const size_t encoder_binding_count = sizeof(encoder_bindings) / sizeof(encoder_bindings[0]);");
        }

        private static void AppendLedConfiguration(StringBuilder sb, ConfigurationDefinition configuration, int neoPixelCount)
        {
            if (neoPixelCount <= 0)
            {
                sb.AppendLine("const led_configuration_t led_configuration = {");
                AppendLine(sb, 1, ".count = 0,");
                AppendLine(sb, 1, ".brightness_percent = 0,");
                AppendLine(sb, 1, ".rainbow_step_ms = 0,");
                AppendLine(sb, 1, ".breathing_min_percent = 0,");
                AppendLine(sb, 1, ".breathing_step_ms = 0,");
                AppendLine(sb, 1, ".passive_modes = 0,");
                AppendLine(sb, 1, ".passive_colors = 0,");
                AppendLine(sb, 1, ".active_modes = 0,");
                AppendLine(sb, 1, ".active_colors = 0");
                AppendLine(sb, 0, "};");
                return;
            }

            var led = configuration.LedConfig ?? throw new InvalidOperationException("LED configuration missing.");
            if (led.Leds.Count != neoPixelCount)
            {
                throw new InvalidOperationException("LED configuration count does not match neopixel count.");
            }

            AppendLine(sb, 0, "static const led_passive_mode_t led_passive_modes[] = {");
            for (int i = 0; i < neoPixelCount; i++)
            {
                var modeLiteral = ToPassiveModeLiteral(led.Leds[i].PassiveMode);
                var tail = i == neoPixelCount - 1 ? string.Empty : ",";
                AppendLine(sb, 1, modeLiteral + tail);
            }
            AppendLine(sb, 0, "};");
            AppendLine(sb, 0, "static const led_rgb_t led_passive_colors[] = {");
            for (int i = 0; i < neoPixelCount; i++)
            {
                var color = led.Leds[i].PassiveColor;
                var tail = i == neoPixelCount - 1 ? string.Empty : ",";
                AppendLine(sb, 1, $"{{ .r = {color.R}, .g = {color.G}, .b = {color.B} }}{tail}");
            }
            AppendLine(sb, 0, "};");
            AppendLine(sb, 0, "static const led_active_mode_t led_active_modes[] = {");
            for (int i = 0; i < neoPixelCount; i++)
            {
                var modeLiteral = ToActiveModeLiteral(led.Leds[i].ActiveMode);
                var tail = i == neoPixelCount - 1 ? string.Empty : ",";
                AppendLine(sb, 1, modeLiteral + tail);
            }
            AppendLine(sb, 0, "};");
            AppendLine(sb, 0, "static const led_rgb_t led_active_colors[] = {");
            for (int i = 0; i < neoPixelCount; i++)
            {
                var color = led.Leds[i].ActiveColor;
                var tail = i == neoPixelCount - 1 ? string.Empty : ",";
                AppendLine(sb, 1, $"{{ .r = {color.R}, .g = {color.G}, .b = {color.B} }}{tail}");
            }
            AppendLine(sb, 0, "};");
            AppendLine(sb, 0, "static const uint8_t led_rainbow_step_ms[] = {");
            for (int i = 0; i < neoPixelCount; i++)
            {
                var timing = led.Leds[i].Timing ?? new LedTiming();
                var tail = i == neoPixelCount - 1 ? string.Empty : ",";
                AppendLine(sb, 1, $"{timing.RainbowStepMs}{tail}");
            }
            AppendLine(sb, 0, "};");
            AppendLine(sb, 0, "static const uint8_t led_breathing_min_percent[] = {");
            for (int i = 0; i < neoPixelCount; i++)
            {
                var timing = led.Leds[i].Timing ?? new LedTiming();
                var tail = i == neoPixelCount - 1 ? string.Empty : ",";
                AppendLine(sb, 1, $"{timing.BreathingMinPercent}{tail}");
            }
            AppendLine(sb, 0, "};");
            AppendLine(sb, 0, "static const uint8_t led_breathing_step_ms[] = {");
            for (int i = 0; i < neoPixelCount; i++)
            {
                var timing = led.Leds[i].Timing ?? new LedTiming();
                var tail = i == neoPixelCount - 1 ? string.Empty : ",";
                AppendLine(sb, 1, $"{timing.BreathingStepMs}{tail}");
            }
            AppendLine(sb, 0, "};");
            sb.AppendLine("const led_configuration_t led_configuration = {");
            AppendLine(sb, 1, $".count = {neoPixelCount},");
            AppendLine(sb, 1, $".brightness_percent = {led.BrightnessPercent},");
            AppendLine(sb, 1, $".rainbow_step_ms = led_rainbow_step_ms,");
            AppendLine(sb, 1, $".breathing_min_percent = led_breathing_min_percent,");
            AppendLine(sb, 1, $".breathing_step_ms = led_breathing_step_ms,");
            AppendLine(sb, 1, ".passive_modes = led_passive_modes,");
            AppendLine(sb, 1, ".passive_colors = led_passive_colors,");
            AppendLine(sb, 1, ".active_modes = led_active_modes,");
            AppendLine(sb, 1, ".active_colors = led_active_colors");
            AppendLine(sb, 0, "};");
        }

        private static int CalculateMaxKeySteps(ConfigurationDefinition configuration)
        {
            int maxSteps = 0;

            foreach (var button in configuration.Buttons)
            {
                if (button.Function is HidSequenceBinding sequence)
                {
                    if (sequence.Steps.Count > maxSteps)
                    {
                        maxSteps = sequence.Steps.Count;
                    }
                }
            }

            foreach (var encoder in configuration.Encoders)
            {
                if (encoder.Clockwise is HidSequenceBinding clockwise && clockwise.Steps.Count > maxSteps)
                {
                    maxSteps = clockwise.Steps.Count;
                }

                if (encoder.CounterClockwise is HidSequenceBinding counter && counter.Steps.Count > maxSteps)
                {
                    maxSteps = counter.Steps.Count;
                }
            }

            return maxSteps;
        }

        private static int CalculateNeoPixelCount(IReadOnlyCollection<ButtonBinding> buttons)
        {
            var maxLedIndex = -1;
            foreach (var button in buttons)
            {
                if (button.LedIndex > maxLedIndex)
                {
                    maxLedIndex = button.LedIndex;
                }
            }

            var count = maxLedIndex + 1;
            return count < 0 ? 0 : count;
        }

        private static string ToPassiveModeLiteral(PassiveLedMode mode) => mode switch
        {
            PassiveLedMode.Off => "LED_PASSIVE_OFF",
            PassiveLedMode.Rainbow => "LED_PASSIVE_RAINBOW",
            PassiveLedMode.Static => "LED_PASSIVE_STATIC",
            PassiveLedMode.Breathing => "LED_PASSIVE_BREATHING",
            _ => "LED_PASSIVE_RAINBOW"
        };

        private static string ToActiveModeLiteral(ActiveLedMode mode) => mode switch
        {
            ActiveLedMode.Off => "LED_ACTIVE_OFF",
            ActiveLedMode.Solid => "LED_ACTIVE_SOLID",
            ActiveLedMode.Nothing => "LED_ACTIVE_NOTHING",
            _ => "LED_ACTIVE_SOLID"
        };

        private static void AppendButton(StringBuilder sb, ButtonBinding button, bool isLast, bool debugMode)
        {
            AppendLine(sb, 1, "{");
            AppendLine(sb, 2, $".pin = {button.Pin},");
            AppendLine(sb, 2, $".active_low = {ToCBoolean(button.ActiveLow)},");
            AppendLine(sb, 2, $".led_index = {button.LedIndex},");
            AppendLine(sb, 2, $".bootloader_on_boot = {ToCBoolean(button.BootloaderOnBoot)},");
            AppendLine(sb, 2, $".bootloader_chord_member = {ToCBoolean(button.BootloaderChordMember)},");
            AppendBindingBlock(sb, 2, "function", button.Function, debugMode, appendTrailingComma: false);
            AppendLine(sb, 1, isLast ? "}" : "},");
        }

        private static void AppendEncoder(StringBuilder sb, EncoderBinding encoder, bool isLast, bool debugMode)
        {
            AppendLine(sb, 1, "{");
            AppendLine(sb, 2, $".pin_a = {encoder.PinA},");
            AppendLine(sb, 2, $".pin_b = {encoder.PinB},");
            AppendBindingBlock(sb, 2, "clockwise", encoder.Clockwise, debugMode, appendTrailingComma: true);
            AppendBindingBlock(sb, 2, "counter_clockwise", encoder.CounterClockwise, debugMode, appendTrailingComma: false);
            AppendLine(sb, 1, isLast ? "}" : "},");
        }

        private static void AppendBindingBlock(StringBuilder sb, int indentLevel, string fieldName, HidBinding binding, bool debugMode, bool appendTrailingComma)
        {
            AppendLine(sb, indentLevel, $".{fieldName} = {{");
            if (debugMode)
            {
                AppendLine(sb, indentLevel + 1, ".type = HID_BINDING_NULL,");
                AppendLine(sb, indentLevel + 1, ".function.functionPointer = 0");
            }
            else
            {
                AppendBindingContent(sb, indentLevel + 1, binding);
            }
            AppendLine(sb, indentLevel, appendTrailingComma ? "}," : "}");
        }

        private static void AppendBindingContent(StringBuilder sb, int indentLevel, HidBinding binding)
        {
            if (binding is not HidSequenceBinding sequenceBinding)
            {
                throw new InvalidOperationException($"Unsupported binding type: {binding.GetType().Name}");
            }

            AppendLine(sb, indentLevel, ".type = HID_BINDING_SEQUENCE,");
            AppendLine(sb, indentLevel, ".function.sequence = {");
            AppendLine(sb, indentLevel + 1, ".steps = {");
            if (sequenceBinding.Steps.Count == 0)
            {
                // SDCC balks at an empty initializer list; seed with a zeroed element
                AppendLine(sb, indentLevel + 2, "{0}");
            }
            else
            {
                for (int i = 0; i < sequenceBinding.Steps.Count; i++)
                {
                    var step = sequenceBinding.Steps[i];
                    var isLast = i == sequenceBinding.Steps.Count - 1;
                    var kindLiteral = step.Kind switch
                    {
                        HidStepKind.Key => "HID_STEP_KEY",
                        HidStepKind.Pause => "HID_STEP_PAUSE",
                        HidStepKind.Function => "HID_STEP_FUNCTION",
                        HidStepKind.Mouse => "HID_STEP_MOUSE",
                        _ => throw new InvalidOperationException($"Unsupported step kind: {step.Kind}")
                    };
                    var functionPointer = step.Kind == HidStepKind.Function
                        ? step.FunctionPointer ?? throw new InvalidOperationException("Function steps must specify a functionPointer.")
                        : "0";
                    var keycodeLiteral = step.Kind == HidStepKind.Key
                        ? ToCharLiteral((char)step.Keycode)
                        : step.Keycode.ToString();
                    var pointerType = step.Kind == HidStepKind.Mouse ? step.PointerType : HidPointerType.MoveUp;
                    var pointerTypeLiteral = ((byte)pointerType).ToString();
                    var pointerValue = (byte)0;
                    if (step.Kind == HidStepKind.Mouse)
                    {
                        if (pointerType is HidPointerType.LeftClick or HidPointerType.RightClick)
                        {
                            pointerValue = 0;
                        }
                        else if (pointerType is HidPointerType.ScrollUp or HidPointerType.ScrollDown)
                        {
                            pointerValue = step.PointerValue == 0 ? (byte)1 : step.PointerValue;
                        }
                        else
                        {
                            pointerValue = step.PointerValue == 0 ? (byte)100 : step.PointerValue;
                        }
                    }
                    var functionValue = step.Kind == HidStepKind.Function ? (step.FunctionValue == 0 ? (byte)1 : step.FunctionValue) : (byte)1;

                    AppendLine(sb, indentLevel + 2, "{");
                    AppendLine(sb, indentLevel + 3, $".kind = {kindLiteral},");
                    AppendLine(sb, indentLevel + 3, $".keycode = {keycodeLiteral},");
                    AppendLine(sb, indentLevel + 3, $".modifiers = {step.Modifiers},");
                    AppendLine(sb, indentLevel + 3, $".hold_ms = {step.HoldMs},");
                    AppendLine(sb, indentLevel + 3, $".gap_ms = {step.GapMs},");
                    AppendLine(sb, indentLevel + 3, $".function_value = {functionValue},");
                    AppendLine(sb, indentLevel + 3, $".pointer_type = {pointerTypeLiteral},");
                    AppendLine(sb, indentLevel + 3, $".pointer_value = {pointerValue},");
                    AppendLine(sb, indentLevel + 3, $".functionPointer = {functionPointer}");
                    AppendLine(sb, indentLevel + 2, isLast ? "}" : "},");
                }
            }
            AppendLine(sb, indentLevel + 1, "},");
            AppendLine(sb, indentLevel + 1, $".length = {sequenceBinding.Steps.Count}");
            AppendLine(sb, indentLevel, "}");
        }

        private static void AppendLine(StringBuilder sb, int indentLevel, string text)
        {
            sb.Append(new string(' ', indentLevel * 4));
            sb.AppendLine(text);
        }

        private static string ToCBoolean(bool value) => value ? "true" : "false";

        private static string ToCInteger(bool value) => value ? "1" : "0";

        private static string ToCharLiteral(char value)
        {
            return value switch
            {
                '\\' => "'\\\\'",
                '\'' => "'\\\''",
                '\n' => "'\\n'",
                '\r' => "'\\r'",
                '\t' => "'\\t'",
                _ when value < 32 || value > 126 => $"0x{((int)value):X2}",
                _ => $"'{value}'"
            };
        }

    }
}
