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
            var configuration = new ConfigurationDefinition(
                new List<ButtonBinding>
                {
                    new ButtonBinding(1, true, -1, false, false, new HidSequenceBinding("a", 0)),
                    new ButtonBinding(2, false, 0, true, true, new HidFunctionBinding("hid_consumer_volume_up"))
                },
                Array.Empty<EncoderBinding>(),
                DebugMode: false,
                NeoPixelPin: 34);

            var expected = Lines(
                "#pragma once",
                string.Empty,
                "#include \"src/configuration_data.h\"",
                string.Empty,
                "#define CONFIGURATION_BUTTON_CAPACITY 2",
                "#define CONFIGURATION_ENCODER_CAPACITY 0",
                "#define CONFIGURATION_DEBUG_MODE 0",
                string.Empty,
                "#define PIN_NEO P34",
                "#define NEO_COUNT 1",
                "#define NEO_GRB");

            var result = Generator.GenerateHeader(configuration);

            Assert.That(result, Is.EqualTo(expected));
        }

        [Test]
        public void GenerateHeader_WithMultipleLedIndices_ComputesNeoCountFromBindings()
        {
            var configuration = new ConfigurationDefinition(
                new List<ButtonBinding>
                {
                    new ButtonBinding(1, true, -1, false, false, new HidSequenceBinding("a", 0)),
                    new ButtonBinding(2, true, 4, false, false, new HidSequenceBinding("b", 0))
                },
                Array.Empty<EncoderBinding>(),
                DebugMode: false,
                NeoPixelPin: 34);

            var result = Generator.GenerateHeader(configuration);

            Assert.That(result, Does.Contain("#define NEO_COUNT 5"));
        }

        [Test]
        public void GenerateHeader_WithCustomNeoPixelPin_EmitsPin()
        {
            var configuration = new ConfigurationDefinition(
                new List<ButtonBinding>
                {
                    new ButtonBinding(1, true, 0, false, false, new HidSequenceBinding("a", 0))
                },
                Array.Empty<EncoderBinding>(),
                DebugMode: false,
                NeoPixelPin: 31);

            var result = Generator.GenerateHeader(configuration);

            Assert.That(result, Does.Contain("#define PIN_NEO P31"));
        }

        [Test]
        public void GenerateHeader_WithNoAssignedLedIndices_SetsNeoCountToZero()
        {
            var configuration = new ConfigurationDefinition(
                new List<ButtonBinding>
                {
                    new ButtonBinding(1, true, -1, false, false, new HidSequenceBinding("a", 0))
                },
                Array.Empty<EncoderBinding>(),
                DebugMode: false,
                NeoPixelPin: 34);

            var result = Generator.GenerateHeader(configuration);

            Assert.That(result, Does.Contain("#define NEO_COUNT 0"));
            Assert.That(result, Does.Not.Contain("#define PIN_NEO"));
            Assert.That(result, Does.Not.Contain("#define NEO_GRB"));
        }

        [Test]
        public void GenerateHeader_WithDebugMode_EmitsFlag()
        {
            var configuration = new ConfigurationDefinition(
                Array.Empty<ButtonBinding>(),
                Array.Empty<EncoderBinding>(),
                DebugMode: true,
                NeoPixelPin: 34);

            var result = Generator.GenerateHeader(configuration);

            Assert.That(result, Does.Contain("#define CONFIGURATION_DEBUG_MODE 1"));
        }

        [Test]
        public void GenerateSource_WithTwoButtons_WritesExpectedConfiguration()
        {
            var buttons = new List<ButtonBinding>
            {
                new ButtonBinding(
                    Pin: 5,
                    ActiveLow: false,
                    LedIndex: -1,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: false,
                    Function: new HidSequenceBinding("ab", 10)),
                new ButtonBinding(
                    Pin: 6,
                    ActiveLow: true,
                    LedIndex: 1,
                    BootloaderOnBoot: true,
                    BootloaderChordMember: true,
                    Function: new HidFunctionBinding("hid_consumer_volume_down"))
            };

            var configuration = new ConfigurationDefinition(buttons, Array.Empty<EncoderBinding>(), DebugMode: false, NeoPixelPin: 34);

            var expected = ReadExpected("generate_source_2_buttons.c");

            var result = Generator.GenerateSource(configuration);

            Assert.That(result, Is.EqualTo(expected));
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
                    BootloaderOnBoot: true,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("2", 0)),
                new ButtonBinding(
                    Pin: 17,
                    ActiveLow: true,
                    LedIndex: 2,
                    BootloaderOnBoot: true,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("3", 0)),
                new ButtonBinding(
                    Pin: 11,
                    ActiveLow: true,
                    LedIndex: 3,
                    BootloaderOnBoot: true,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("4", 0))
            };

            var configuration = new ConfigurationDefinition(buttons, Array.Empty<EncoderBinding>(), DebugMode: false, NeoPixelPin: 34);

            var expected = ReadExpected("generate_source_4_buttons.c");

            var result = Generator.GenerateSource(configuration);

            Assert.That(result, Is.EqualTo(expected));
        }

        [Test]
        public void GenerateSource_WithTwoButtonModule_WritesExpectedConfiguration()
        {
            var buttons = new List<ButtonBinding>
            {
                new ButtonBinding(32, true, -1, true, true, new HidSequenceBinding("1", 0)),
                new ButtonBinding(14, true, -1, true, true, new HidSequenceBinding("2", 0))
            };

            var configuration = new ConfigurationDefinition(buttons, Array.Empty<EncoderBinding>(), DebugMode: false, NeoPixelPin: -1);

            var expected = ReadExpected("generate_source_2_button_module.c");

            var result = Generator.GenerateSource(configuration);

            Assert.That(result, Is.EqualTo(expected));
        }

        [Test]
        public void GenerateSource_WithDebugMode_WritesInactiveBindings()
        {
            var buttons = new List<ButtonBinding>
            {
                new ButtonBinding(5, true, 0, false, false, new HidSequenceBinding("ab", 1))
            };

            var encoders = new List<EncoderBinding>
            {
                new EncoderBinding(10, 11, new HidFunctionBinding("hid_consumer_volume_up"), new HidFunctionBinding("hid_consumer_volume_down"))
            };

            var configuration = new ConfigurationDefinition(buttons, encoders, DebugMode: true, NeoPixelPin: 34);

            var result = Generator.GenerateSource(configuration);

            Assert.That(result, Does.Contain(".type = HID_BINDING_NULL"));
            Assert.That(result, Does.Contain(".function.functionPointer = 0"));
        }

        [Test]
        public void GenerateSource_WithTenButtons_WritesExpectedConfiguration()
        {
            var buttons = new List<ButtonBinding>
            {
                new ButtonBinding(32, true, -1, true, true, new HidSequenceBinding("0", 0)),
                new ButtonBinding(14, true, -1, true, true, new HidSequenceBinding("1", 0)),
                new ButtonBinding(15, true, -1, true, true, new HidSequenceBinding("2", 0)),
                new ButtonBinding(16, true, -1, true, true, new HidSequenceBinding("3", 0)),
                new ButtonBinding(17, true, -1, true, true, new HidSequenceBinding("4", 0)),
                new ButtonBinding(31, true, -1, true, true, new HidSequenceBinding("5", 0)),
                new ButtonBinding(30, true, -1, true, true, new HidSequenceBinding("6", 0)),
                new ButtonBinding(11, true, -1, true, true, new HidSequenceBinding("7", 0)),
                new ButtonBinding(33, true, -1, true, true, new HidSequenceBinding("8", 0)),
                new ButtonBinding(34, true, -1, true, true, new HidSequenceBinding("9", 0))
            };

            var configuration = new ConfigurationDefinition(buttons, Array.Empty<EncoderBinding>(), DebugMode: false, NeoPixelPin: -1);

            var expected = ReadExpected("generate_source_10_buttons.c");

            var result = Generator.GenerateSource(configuration);

            Assert.That(result, Is.EqualTo(expected));
        }

        [Test]
        public void GenerateSource_WithFourButtonsAndEncoder_WritesExpectedConfiguration()
        {
             var buttons = new List<ButtonBinding>
            {
                new ButtonBinding(
                    Pin: 11,
                    ActiveLow: true,
                    LedIndex: 0,
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
                    Pin: 16,
                    ActiveLow: true,
                    LedIndex: 2,
                    BootloaderOnBoot: false,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("c", 0)),
                new ButtonBinding(
                    Pin: 33,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: true,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("d", 0))
            };

            var encoders = new List<EncoderBinding>
            {
                new EncoderBinding(
                    PinA: 31,
                    PinB: 30,
                    Clockwise: new HidFunctionBinding("hid_consumer_volume_up"),
                    CounterClockwise: new HidFunctionBinding("hid_consumer_volume_down"))
            };

            var configuration = new ConfigurationDefinition(buttons, encoders, DebugMode: false, NeoPixelPin: 34);

            var expected = ReadExpected("generate_source_4_buttons_1_dial.c");

            var result = Generator.GenerateSource(configuration);

            Assert.That(result, Is.EqualTo(expected));
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
