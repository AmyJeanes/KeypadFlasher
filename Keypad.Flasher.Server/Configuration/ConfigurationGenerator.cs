using System.Text;

namespace Keypad.Flasher.Server.Configuration
{
    public class ConfigurationGenerator
    {
        public string GenerateHeader(ConfigurationDefinition configuration)
        {
            var neoPixelCount = CalculateNeoPixelCount(configuration.Buttons);
            var sb = new StringBuilder();
            sb.AppendLine("#pragma once");
            sb.AppendLine();
            sb.AppendLine("#include \"src/configuration_data.h\"");
            sb.AppendLine();
            sb.AppendLine($"#define CONFIGURATION_BUTTON_CAPACITY {configuration.Buttons.Count}");
            sb.AppendLine($"#define CONFIGURATION_ENCODER_CAPACITY {configuration.Encoders.Count}");
            sb.AppendLine($"#define CONFIGURATION_DEBUG_MODE {ToCInteger(configuration.DebugMode)}");
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
            }
            else
            {
                sb.AppendLine("#define NEO_COUNT 0");
            }
            return sb.ToString();
        }

        public string GenerateSource(ConfigurationDefinition configuration)
        {
            var sb = new StringBuilder();
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
            switch (binding)
            {
                case HidSequenceBinding sequenceBinding:
                    AppendLine(sb, indentLevel, ".type = HID_BINDING_SEQUENCE,");
                    AppendLine(sb, indentLevel, ".function.sequence = {");
                    AppendLine(sb, indentLevel + 1, $".sequence = {{{string.Join(", ", sequenceBinding.Sequence.Select(ToCharLiteral))}}},");
                    AppendLine(sb, indentLevel + 1, $".length = {sequenceBinding.Sequence.Length},");
                    AppendLine(sb, indentLevel + 1, $".delay = {sequenceBinding.Delay}");
                    AppendLine(sb, indentLevel, "}");
                    break;
                case HidFunctionBinding functionBinding:
                    AppendLine(sb, indentLevel, ".type = HID_BINDING_FUNCTION,");
                    AppendLine(sb, indentLevel, $".function.functionPointer = {functionBinding.FunctionPointer}");
                    break;
                default:
                    throw new InvalidOperationException($"Unsupported binding type: {binding.GetType().Name}");
            }
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
