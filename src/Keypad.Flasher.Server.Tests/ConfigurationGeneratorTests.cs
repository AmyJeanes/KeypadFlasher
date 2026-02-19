using System;
using System.Collections.Generic;
using System.Linq;
using Keypad.Flasher.Server.Configuration;
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
            var buttons = new List<ButtonBinding>
            {
                new ButtonBinding(
                    Pin: 1,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: false,
                    Function: new HidSequenceBinding("a", 0)),
                new ButtonBinding(
                    Pin: 2,
                    ActiveLow: false,
                    LedIndex: 0,
                    BootloaderOnBoot: true,
                    BootloaderChordMember: true,
                    Function: HidSequenceBinding.FromFunction("hid_consumer_volume_up"))
            };

            var configuration = new ConfigurationDefinition(
                buttons,
                Array.Empty<EncoderBinding>(),
                DebugMode: false,
                NeoPixelPin: 34,
                NeoPixelReversed: false,
                LedConfig: DefaultLedConfig(buttons),
                DebugOptions: DebugOptions.Default);

            var expected = Lines(
                "// This file is auto-generated. Do not edit manually.",
                string.Empty,
                "#pragma once",
                string.Empty,
                "#include \"src/configuration_data.h\"",
                string.Empty,
                "#define CONFIGURATION_BUTTON_CAPACITY 2",
                "#define CONFIGURATION_ENCODER_CAPACITY 0",
                "#define CONFIGURATION_DEBUG_MODE 0",
                "#define DEBUG_NOISE_FILTER_ENABLED 1",
                "#define DEBUG_PULLUPS_ENABLED 1",
                "#define DEBUG_CONFIRM_SAMPLES 3",
                "#define DEBUG_CONFIRM_DELAY_MS 1",
                "#define HID_MAX_KEY_STEPS 1",
                string.Empty,
                "#define PIN_NEO P34",
                "#define NEO_COUNT 1",
                "#define NEO_GRB",
                "#define NEO_REVERSED 0");

            var result = Generator.GenerateHeader(configuration);

            Assert.That(result, Is.EqualTo(expected));
        }

        [Test]
        public void GenerateHeader_WithMultipleLedIndices_ComputesNeoCountFromBindings()
        {
            var buttons = new List<ButtonBinding>
            {
                new ButtonBinding(
                    Pin: 1,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: false,
                    Function: new HidSequenceBinding("a", 0)),
                new ButtonBinding(
                    Pin: 2,
                    ActiveLow: true,
                    LedIndex: 4,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: false,
                    Function: new HidSequenceBinding("b", 0))
            };

            var configuration = new ConfigurationDefinition(
                buttons,
                Array.Empty<EncoderBinding>(),
                DebugMode: false,
                NeoPixelPin: 34,
                NeoPixelReversed: false,
                LedConfig: DefaultLedConfig(buttons),
                DebugOptions: DebugOptions.Default);

            var result = Generator.GenerateHeader(configuration);

            Assert.That(result, Does.Contain("#define NEO_COUNT 5"));
        }

        [Test]
        public void GenerateHeader_WithCustomNeoPixelPin_EmitsPin()
        {
            var buttons = new List<ButtonBinding>
            {
                new ButtonBinding(
                    Pin: 1,
                    ActiveLow: true,
                    LedIndex: 0,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: false,
                    Function: new HidSequenceBinding("a", 0))
            };

            var configuration = new ConfigurationDefinition(
                buttons,
                Array.Empty<EncoderBinding>(),
                DebugMode: false,
                NeoPixelPin: 31,
                NeoPixelReversed: false,
                LedConfig: DefaultLedConfig(buttons),
                DebugOptions: DebugOptions.Default);

            var result = Generator.GenerateHeader(configuration);

            Assert.That(result, Does.Contain("#define PIN_NEO P31"));
        }

        [Test]
        public void GenerateHeader_WithReversedNeoPixels_EmitsFlag()
        {
            var buttons = new List<ButtonBinding>
            {
                new ButtonBinding(
                    Pin: 1,
                    ActiveLow: true,
                    LedIndex: 0,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: false,
                    Function: new HidSequenceBinding("a", 0))
            };

            var configuration = new ConfigurationDefinition(
                buttons,
                Array.Empty<EncoderBinding>(),
                DebugMode: false,
                NeoPixelPin: 31,
                NeoPixelReversed: true,
                LedConfig: DefaultLedConfig(buttons),
                DebugOptions: DebugOptions.Default);

            var result = Generator.GenerateHeader(configuration);

            Assert.That(result, Does.Contain("#define NEO_REVERSED 1"));
        }

        [Test]
        public void GenerateHeader_WithNoAssignedLedIndices_SetsNeoCountToZero()
        {
            var buttons = new List<ButtonBinding>
            {
                new ButtonBinding(
                    Pin: 1,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: false,
                    Function: new HidSequenceBinding("a", 0))
            };

            var configuration = new ConfigurationDefinition(
                buttons,
                Array.Empty<EncoderBinding>(),
                DebugMode: false,
                NeoPixelPin: 34,
                NeoPixelReversed: false,
                LedConfig: DefaultLedConfig(buttons),
                DebugOptions: DebugOptions.Default);

            var result = Generator.GenerateHeader(configuration);

            Assert.That(result, Does.Contain("#define NEO_COUNT 0"));
            Assert.That(result, Does.Not.Contain("#define PIN_NEO"));
            Assert.That(result, Does.Not.Contain("#define NEO_GRB"));
            Assert.That(result, Does.Contain("#define NEO_REVERSED 0"));
        }

        [Test]
        public void GenerateHeader_WithDebugMode_EmitsFlag()
        {
            var buttons = Array.Empty<ButtonBinding>();
            var configuration = new ConfigurationDefinition(
                buttons,
                Array.Empty<EncoderBinding>(),
                DebugMode: true,
                NeoPixelPin: 34,
                NeoPixelReversed: false,
                LedConfig: DefaultLedConfig(buttons),
                DebugOptions: DebugOptions.Default);

            var result = Generator.GenerateHeader(configuration);

            Assert.That(result, Does.Contain("#define CONFIGURATION_DEBUG_MODE 1"));
        }

        [Test]
        public void GenerateSource_WithDebugMode_WritesInactiveBindings()
        {
            var buttons = new List<ButtonBinding>
            {
                new ButtonBinding(
                    Pin: 5,
                    ActiveLow: true,
                    LedIndex: 0,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: false,
                    Function: new HidSequenceBinding("ab", 1))
            };

            var encoders = new List<EncoderBinding>
            {
                new EncoderBinding(10, 11, HidSequenceBinding.FromFunction("hid_consumer_volume_up"), HidSequenceBinding.FromFunction("hid_consumer_volume_down"))
            };

            var configuration = new ConfigurationDefinition(
                buttons,
                encoders,
                DebugMode: true,
                NeoPixelPin: 34,
                NeoPixelReversed: false,
                LedConfig: DefaultLedConfig(buttons),
                DebugOptions: DebugOptions.Default);

            var result = Generator.GenerateSource(configuration);

            Assert.That(result, Does.Contain(".type = HID_BINDING_NULL"));
            Assert.That(result, Does.Contain(".function.functionPointer = 0"));
        }

        [Test]
        public void GenerateSource_WithFourButtons_WritesExpectedConfiguration()
        {
            var buttons = new List<ButtonBinding>
            {
                new ButtonBinding(
                    Pin: 15,
                    ActiveLow: true,
                    LedIndex: 0,
                    BootloaderOnBoot: true,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("1", 0)),
                new ButtonBinding(
                    Pin: 16,
                    ActiveLow: true,
                    LedIndex: 1,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("2", 0)),
                new ButtonBinding(
                    Pin: 17,
                    ActiveLow: true,
                    LedIndex: 2,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("3", 0)),
                new ButtonBinding(
                    Pin: 11,
                    ActiveLow: true,
                    LedIndex: 3,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("4", 0))
            };

            var configuration = new ConfigurationDefinition(
                buttons,
                Array.Empty<EncoderBinding>(),
                DebugMode: false,
                NeoPixelPin: 34,
                NeoPixelReversed: false,
                LedConfig: DefaultLedConfig(buttons),
                DebugOptions: DebugOptions.Default);

            var expected = ReadExpected("generate_source_4_buttons.c");

            var result = Generator.GenerateSource(configuration);

            Assert.That(result, Is.EqualTo(expected));
        }

        [Test]
        public void GenerateSource_WithTwoButtons_WritesExpectedConfiguration()
        {
            var buttons = new List<ButtonBinding>
            {
                new ButtonBinding(
                    Pin: 32,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: true,
                    BootloaderChordMember: false,
                    Function: new HidSequenceBinding("1", 0)),
                new ButtonBinding(
                    Pin: 14,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: false,
                    Function: new HidSequenceBinding("2", 0))
            };

            var configuration = new ConfigurationDefinition(
                buttons,
                Array.Empty<EncoderBinding>(),
                DebugMode: false,
                NeoPixelPin: -1,
                NeoPixelReversed: false,
                LedConfig: DefaultLedConfig(buttons),
                DebugOptions: DebugOptions.Default);

            var expected = ReadExpected("generate_source_2_buttons.c");

            var result = Generator.GenerateSource(configuration);

            Assert.That(result, Is.EqualTo(expected));
        }

        [Test]
        public void GenerateSource_WithTenButtons_WritesExpectedConfiguration()
        {
            var buttons = new List<ButtonBinding>
            {
                new ButtonBinding(
                    Pin: 32,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: true,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("0", 0)),
                new ButtonBinding(
                    Pin: 14,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("1", 0)),
                new ButtonBinding(
                    Pin: 15,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("2", 0)),
                new ButtonBinding(
                    Pin: 16,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("3", 0)),
                new ButtonBinding(
                    Pin: 17,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("4", 0)),
                new ButtonBinding(
                    Pin: 31,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("5", 0)),
                new ButtonBinding(
                    Pin: 30,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("6", 0)),
                new ButtonBinding(
                    Pin: 11,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("7", 0)),
                new ButtonBinding(
                    Pin: 33,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("8", 0)),
                new ButtonBinding(
                    Pin: 34,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("9", 0))
            };

            var configuration = new ConfigurationDefinition(
                buttons,
                Array.Empty<EncoderBinding>(),
                DebugMode: false,
                NeoPixelPin: -1,
                NeoPixelReversed: false,
                LedConfig: DefaultLedConfig(buttons),
                DebugOptions: DebugOptions.Default);

            var expected = ReadExpected("generate_source_10_buttons.c");

            var result = Generator.GenerateSource(configuration);

            Assert.That(result, Is.EqualTo(expected));
        }

        [Test]
        public void GenerateSource_WithThreeButtonsAndEncoder_WritesExpectedConfiguration()
        {
             var buttons = new List<ButtonBinding>
            {
                new ButtonBinding(
                    Pin: 33,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: true,
                    BootloaderChordMember: false,
                    Function: new HidSequenceBinding("enter", 5)),
                new ButtonBinding(
                    Pin: 16,
                    ActiveLow: true,
                    LedIndex: 2,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("a", 0)),
                new ButtonBinding(
                    Pin: 17,
                    ActiveLow: true,
                    LedIndex: 1,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("b", 0)),
                new ButtonBinding(
                    Pin: 11,
                    ActiveLow: true,
                    LedIndex: 0,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("c", 0)),
            };

            var encoders = new List<EncoderBinding>
            {
                new EncoderBinding(
                    PinA: 31,
                    PinB: 30,
                    Clockwise: HidSequenceBinding.FromFunction("hid_consumer_volume_up"),
                    CounterClockwise: HidSequenceBinding.FromFunction("hid_consumer_volume_down"))
            };

            var configuration = new ConfigurationDefinition(
                buttons,
                encoders,
                DebugMode: false,
                NeoPixelPin: 34,
                NeoPixelReversed: false,
                LedConfig: DefaultLedConfig(buttons),
                DebugOptions: DebugOptions.Default);

            var expected = ReadExpected("generate_source_3_buttons_1_encoder.c");

            var result = Generator.GenerateSource(configuration);

            Assert.That(result, Is.EqualTo(expected));
        }

        private static LedConfiguration DefaultLedConfig(IReadOnlyList<ButtonBinding> buttons)
        {
            var maxLedIndex = -1;
            for (var i = 0; i < buttons.Count; i++)
            {
                if (buttons[i].LedIndex > maxLedIndex)
                {
                    maxLedIndex = buttons[i].LedIndex;
                }
            }

            var count = maxLedIndex + 1;
            if (count <= 0)
            {
                return new LedConfiguration(
                    Leds: Array.Empty<LedPerKey>(),
                    BrightnessPercent: 0);
            }

            var leds = new LedPerKey[count];
            var baseColors = new[]
            {
                new LedColor(255, 0, 0),
                new LedColor(255, 255, 0),
                new LedColor(0, 255, 0)
            };

            for (var i = 0; i < count; i++)
            {
                leds[i] = new LedPerKey(
                    PassiveMode: PassiveLedMode.Rainbow,
                    PassiveColor: baseColors[i % baseColors.Length],
                    ActiveMode: ActiveLedMode.Solid,
                    ActiveColor: new LedColor(255, 255, 255),
                    Timing: new LedTiming());
            }

            return new LedConfiguration(
                Leds: leds,
                BrightnessPercent: 100);
        }

        private static string ReadExpected(string fileName)
        {
            var directory = Path.Combine(TestContext.CurrentContext.TestDirectory, "ExpectedOutputs", "ConfigurationGenerator");
            var path = Path.Combine(directory, fileName);
            var content = File.ReadAllText(path);
            return NormalizeLineEndings(content);
        }

        private static string NormalizeLineEndings(string value)
        {
            return value.Replace("\r\n", "\n").Replace("\n", Environment.NewLine);
        }

        private static string Lines(params string[] lines)
        {
            return string.Join(Environment.NewLine, lines) + Environment.NewLine;
        }
    }
}
