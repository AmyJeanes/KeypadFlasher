using Keypad.Flasher.Server.Configuration;
using NUnit.Framework;
using Builder = Keypad.Flasher.Server.Configuration.ConfigurationBuilder;

namespace Keypad.Flasher.Server.Tests
{
    [TestFixture]
    public class ConfigurationBuilderTests
    {
        [Test]
        public void FromLayout_BuildsExistingConfiguration_OutputMatchesGeneratorFixture()
        {
            var layout = new DeviceLayout(
                Buttons: new List<ButtonLayout>
                {
                    new ButtonLayout(0, 33, true, -1, true, false),
                    new ButtonLayout(1, 16, true, 2, false, true),
                    new ButtonLayout(2, 17, true, 1, false, true),
                    new ButtonLayout(3, 11, true, 0, false, true)
                },
                Encoders: new List<EncoderLayout>
                {
                    new EncoderLayout(0, 31, 30, Press: null)
                },
                NeoPixelPin: 34,
                NeoPixelReversed: false);

            var bindings = new BindingProfile(
                Buttons: new List<ButtonBindingEntry>
                {
                    new ButtonBindingEntry(0, new HidSequenceBinding("enter", 5)),
                    new ButtonBindingEntry(1, new HidSequenceBinding("a", 0)),
                    new ButtonBindingEntry(2, new HidSequenceBinding("b", 0)),
                    new ButtonBindingEntry(3, new HidSequenceBinding("c", 0))
                },
                Encoders: new List<EncoderBindingEntry>
                {
                    new EncoderBindingEntry(0, HidSequenceBinding.FromFunction("hid_consumer_volume_up"), HidSequenceBinding.FromFunction("hid_consumer_volume_down"), Press: null)
                });

            var ledConfig = new LedConfiguration(
                Leds: new[]
                {
                    new LedPerKey(PassiveLedMode.Rainbow, new LedColor(255, 0, 0), ActiveLedMode.Solid, new LedColor(255, 255, 255), new LedTiming()),
                    new LedPerKey(PassiveLedMode.Rainbow, new LedColor(255, 255, 0), ActiveLedMode.Solid, new LedColor(255, 255, 255), new LedTiming()),
                    new LedPerKey(PassiveLedMode.Rainbow, new LedColor(0, 255, 0), ActiveLedMode.Solid, new LedColor(255, 255, 255), new LedTiming())
                },
                BrightnessPercent: 100);

            var configuration = Builder.FromLayout(layout, bindings, debugMode: false, ledConfig: ledConfig);

            var generator = new ConfigurationGenerator();
            var result = generator.GenerateSource(configuration);
            var expected = ReadExpected("generate_source_3_buttons_1_encoder.c");

            Assert.That(result, Is.EqualTo(expected));
        }

        [Test]
        public void FromLayout_WithEncoderPress_AddsButtonBinding()
        {
            var layout = new DeviceLayout(
                Buttons: new List<ButtonLayout>(),
                Encoders: new List<EncoderLayout>
                {
                    new EncoderLayout(
                        1,
                        10,
                        11,
                        new EncoderPressLayout(
                            Pin: 12,
                            ActiveLow: true,
                            BootloaderOnBoot: false,
                            BootloaderChordMember: true))
                },
                NeoPixelPin: -1,
                NeoPixelReversed: false);

            var bindings = new BindingProfile(
                Buttons: new List<ButtonBindingEntry>(),
                Encoders: new List<EncoderBindingEntry>
                {
                    new EncoderBindingEntry(
                        1,
                        HidSequenceBinding.FromFunction("hid_consumer_volume_up"),
                        HidSequenceBinding.FromFunction("hid_consumer_volume_down"),
                        new HidSequenceBinding("x", 0))
                });

            var configuration = Builder.FromLayout(layout, bindings, debugMode: false);

            Assert.That(configuration.Buttons, Has.Count.EqualTo(1));
            var press = configuration.Buttons.Single();
            Assert.That(press.Pin, Is.EqualTo(12));
            Assert.That(press.Function, Is.TypeOf<HidSequenceBinding>());
        }

        [Test]
        public void FromLayout_MissingBinding_Throws()
        {
            var layout = new DeviceLayout(
                Buttons: new List<ButtonLayout> { new ButtonLayout(0, 1, true, -1, false, false) },
                Encoders: Array.Empty<EncoderLayout>(),
                NeoPixelPin: -1,
                NeoPixelReversed: false);

            var bindings = new BindingProfile(Buttons: new List<ButtonBindingEntry>(), Encoders: new List<EncoderBindingEntry>());

            Assert.Throws<InvalidOperationException>(() => Builder.FromLayout(layout, bindings, debugMode: false));
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
    }
}
