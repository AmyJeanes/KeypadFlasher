using System;
using System.Collections.Generic;
using Keypad.Flasher.Server.Configuration;
using Keypad.Flasher.Server.Controllers;
using NUnit.Framework;

namespace Keypad.Flasher.Server.Tests
{
    [TestFixture]
    public class ConfigurationGeneratorTests
    {
        private static readonly ConfigurationGenerator Generator = new();

        [Test]
        public void GenerateHeader_MatchesExpectedLayout()
        {
            var configuration = new ConfigurationDefinition(
                new List<ButtonBinding>
                {
                    new ButtonBinding(1, true, -1, false, false, new HidSequenceBinding("a", 0)),
                    new ButtonBinding(2, false, 0, true, true, new HidFunctionBinding("hid_consumer_volume_up"))
                },
                Array.Empty<EncoderBinding>());

            var expected = Lines(
                "#pragma once",
                string.Empty,
                "#include \"src/configuration_data.h\"",
                string.Empty,
                "#define CONFIGURATION_BUTTON_CAPACITY 2",
                "#define CONFIGURATION_ENCODER_CAPACITY 0");

            var result = Generator.GenerateHeader(configuration);

            Assert.That(result, Is.EqualTo(expected));
        }

        [Test]
        public void GenerateSource_RecreatesCurrentFirmwareConfiguration()
        {
            var configuration = FlasherController.CreateDefaultConfiguration();

            var expected = Lines(
                "#include \"configuration.h\"",
                "#include \"src/userUsbHidKeyboardMouse/USBHIDKeyboardMouse.h\"",
                string.Empty,
                "const button_binding_t button_bindings[] = {",
                "    {",
                "        .pin = 11,",
                "        .active_low = true,",
                "        .led_index = 0,",
                "        .bootloader_on_boot = false,",
                "        .bootloader_chord_member = true,",
                "        .function = {",
                "            .type = HID_BINDING_SEQUENCE,",
                "            .function.sequence = {",
                "                .sequence = {'a'},",
                "                .length = 1,",
                "                .delay = 0",
                "            }",
                "        }",
                "    },",
                "    {",
                "        .pin = 17,",
                "        .active_low = true,",
                "        .led_index = 1,",
                "        .bootloader_on_boot = false,",
                "        .bootloader_chord_member = true,",
                "        .function = {",
                "            .type = HID_BINDING_SEQUENCE,",
                "            .function.sequence = {",
                "                .sequence = {'b'},",
                "                .length = 1,",
                "                .delay = 0",
                "            }",
                "        }",
                "    },",
                "    {",
                "        .pin = 16,",
                "        .active_low = true,",
                "        .led_index = 2,",
                "        .bootloader_on_boot = false,",
                "        .bootloader_chord_member = true,",
                "        .function = {",
                "            .type = HID_BINDING_SEQUENCE,",
                "            .function.sequence = {",
                "                .sequence = {'c'},",
                "                .length = 1,",
                "                .delay = 0",
                "            }",
                "        }",
                "    },",
                "    {",
                "        .pin = 33,",
                "        .active_low = true,",
                "        .led_index = -1,",
                "        .bootloader_on_boot = true,",
                "        .bootloader_chord_member = true,",
                "        .function = {",
                "            .type = HID_BINDING_SEQUENCE,",
                "            .function.sequence = {",
                "                .sequence = {'d'},",
                "                .length = 1,",
                "                .delay = 0",
                "            }",
                "        }",
                "    }",
                "};",
                string.Empty,
                "const size_t button_binding_count = sizeof(button_bindings) / sizeof(button_bindings[0]);",
                string.Empty,
                "const encoder_binding_t encoder_bindings[] = {",
                "    {",
                "        .pin_a = 31,",
                "        .pin_b = 30,",
                "        .clockwise = {",
                "            .type = HID_BINDING_FUNCTION,",
                "            .function.functionPointer = hid_consumer_volume_up",
                "        },",
                "        .counter_clockwise = {",
                "            .type = HID_BINDING_FUNCTION,",
                "            .function.functionPointer = hid_consumer_volume_down",
                "        }",
                "    }",
                "};",
                string.Empty,
                "const size_t encoder_binding_count = sizeof(encoder_bindings) / sizeof(encoder_bindings[0]);");

            var result = Generator.GenerateSource(configuration);

            Assert.That(result, Is.EqualTo(expected));
        }

        [Test]
        public void CreateDefaultConfiguration_HasExpectedBindings()
        {
            var configuration = FlasherController.CreateDefaultConfiguration();

            Assert.Multiple(() =>
            {
                Assert.That(configuration.Buttons, Has.Count.EqualTo(4));
                Assert.That(configuration.Encoders, Has.Count.EqualTo(1));

                var button = configuration.Buttons[0];
                Assert.That(button.Pin, Is.EqualTo(11));
                Assert.That(button.ActiveLow, Is.True);
                Assert.That(button.Function, Is.TypeOf<HidSequenceBinding>());

                var sequence = (HidSequenceBinding)button.Function;
                Assert.That(sequence.Sequence, Is.EqualTo("a"));
                Assert.That(sequence.Delay, Is.EqualTo(0));

                var encoder = configuration.Encoders[0];
                Assert.That(encoder.Clockwise, Is.TypeOf<HidFunctionBinding>());
                var clockwise = (HidFunctionBinding)encoder.Clockwise;
                Assert.That(clockwise.FunctionPointer, Is.EqualTo("hid_consumer_volume_up"));
            });
        }

        private static string Lines(params string[] lines)
        {
            return string.Join(Environment.NewLine, lines) + Environment.NewLine;
        }
    }
}
