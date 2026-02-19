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

        [Test]
        public void FromLayout_WithNullLayout_ThrowsArgumentNullException()
        {
            var bindings = new BindingProfile(Buttons: new List<ButtonBindingEntry>(), Encoders: new List<EncoderBindingEntry>());

            Assert.Throws<ArgumentNullException>(() => Builder.FromLayout(null!, bindings, debugMode: false));
        }

        [Test]
        public void FromLayout_WithNullBindingProfile_ThrowsArgumentNullException()
        {
            var layout = new DeviceLayout(
                Buttons: new List<ButtonLayout>(),
                Encoders: new List<EncoderLayout>(),
                NeoPixelPin: -1,
                NeoPixelReversed: false);

            Assert.Throws<ArgumentNullException>(() => Builder.FromLayout(layout, null!, debugMode: false));
        }

        [Test]
        public void FromLayout_WithDuplicateButtonBindingId_Throws()
        {
            var layout = new DeviceLayout(
                Buttons: new List<ButtonLayout>
                {
                    new ButtonLayout(0, 1, true, -1, false, false)
                },
                Encoders: new List<EncoderLayout>(),
                NeoPixelPin: -1,
                NeoPixelReversed: false);

            var bindings = new BindingProfile(
                Buttons: new List<ButtonBindingEntry>
                {
                    new ButtonBindingEntry(0, new HidSequenceBinding("a", 0)),
                    new ButtonBindingEntry(0, new HidSequenceBinding("b", 0))
                },
                Encoders: new List<EncoderBindingEntry>());

            var ex = Assert.Throws<InvalidOperationException>(() => Builder.FromLayout(layout, bindings, debugMode: false));

            Assert.That(ex!.Message, Does.Contain("Duplicate button binding id '0'"));
        }

        [Test]
        public void FromLayout_WithDuplicateEncoderBindingId_Throws()
        {
            var layout = new DeviceLayout(
                Buttons: new List<ButtonLayout>(),
                Encoders: new List<EncoderLayout>
                {
                    new EncoderLayout(1, 2, 3, Press: null)
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
                        Press: null),
                    new EncoderBindingEntry(
                        1,
                        HidSequenceBinding.FromFunction("hid_consumer_volume_up"),
                        HidSequenceBinding.FromFunction("hid_consumer_volume_down"),
                        Press: null)
                });

            var ex = Assert.Throws<InvalidOperationException>(() => Builder.FromLayout(layout, bindings, debugMode: false));

            Assert.That(ex!.Message, Does.Contain("Duplicate encoder binding id '1'"));
        }

        [Test]
        public void FromLayout_WithMissingEncoderClockwiseBinding_Throws()
        {
            var layout = new DeviceLayout(
                Buttons: new List<ButtonLayout>(),
                Encoders: new List<EncoderLayout>
                {
                    new EncoderLayout(1, 2, 3, Press: null)
                },
                NeoPixelPin: -1,
                NeoPixelReversed: false);

            var bindings = new BindingProfile(
                Buttons: new List<ButtonBindingEntry>(),
                Encoders: new List<EncoderBindingEntry>
                {
                    new EncoderBindingEntry(1, Clockwise: null!, CounterClockwise: new HidSequenceBinding("b", 0), Press: null)
                });

            var ex = Assert.Throws<InvalidOperationException>(() => Builder.FromLayout(layout, bindings, debugMode: false));

            Assert.That(ex!.Message, Does.Contain("Clockwise binding not found for encoder '1'"));
        }

        [Test]
        public void FromLayout_WithMissingEncoderCounterClockwiseBinding_Throws()
        {
            var layout = new DeviceLayout(
                Buttons: new List<ButtonLayout>(),
                Encoders: new List<EncoderLayout>
                {
                    new EncoderLayout(1, 2, 3, Press: null)
                },
                NeoPixelPin: -1,
                NeoPixelReversed: false);

            var bindings = new BindingProfile(
                Buttons: new List<ButtonBindingEntry>(),
                Encoders: new List<EncoderBindingEntry>
                {
                    new EncoderBindingEntry(1, Clockwise: new HidSequenceBinding("a", 0), CounterClockwise: null!, Press: null)
                });

            var ex = Assert.Throws<InvalidOperationException>(() => Builder.FromLayout(layout, bindings, debugMode: false));

            Assert.That(ex!.Message, Does.Contain("Counter-clockwise binding not found for encoder '1'"));
        }

        [Test]
        public void FromLayout_WithLedButtonsAndNoLedConfig_Throws()
        {
            var layout = new DeviceLayout(
                Buttons: new List<ButtonLayout>
                {
                    new ButtonLayout(0, 1, true, 0, false, false)
                },
                Encoders: Array.Empty<EncoderLayout>(),
                NeoPixelPin: 34,
                NeoPixelReversed: false);

            var bindings = new BindingProfile(
                Buttons: new List<ButtonBindingEntry>
                {
                    new ButtonBindingEntry(0, new HidSequenceBinding("a", 0))
                },
                Encoders: new List<EncoderBindingEntry>());

            var ex = Assert.Throws<ArgumentException>(() => Builder.FromLayout(layout, bindings, debugMode: false));

            Assert.That(ex!.Message, Does.Contain("LED configuration required for layouts with LEDs"));
        }

        [Test]
        public void FromLayout_WithLedCountMismatch_Throws()
        {
            var layout = new DeviceLayout(
                Buttons: new List<ButtonLayout>
                {
                    new ButtonLayout(0, 1, true, 1, false, false)
                },
                Encoders: Array.Empty<EncoderLayout>(),
                NeoPixelPin: 34,
                NeoPixelReversed: false);

            var bindings = new BindingProfile(
                Buttons: new List<ButtonBindingEntry>
                {
                    new ButtonBindingEntry(0, new HidSequenceBinding("a", 0))
                },
                Encoders: new List<EncoderBindingEntry>());

            var ledConfig = new LedConfiguration(
                Leds: new[]
                {
                    new LedPerKey(PassiveLedMode.Rainbow, new LedColor(255, 0, 0), ActiveLedMode.Solid, new LedColor(255, 255, 255), new LedTiming())
                },
                BrightnessPercent: 100);

            var ex = Assert.Throws<ArgumentException>(() => Builder.FromLayout(layout, bindings, debugMode: false, ledConfig));

            Assert.That(ex!.Message, Does.Contain("LED configuration must contain 2 LED entries"));
        }

        [Test]
        public void FromLayout_WithLedTimingOverrides_NormalizesTimingValues()
        {
            var layout = new DeviceLayout(
                Buttons: new List<ButtonLayout>
                {
                    new ButtonLayout(0, 1, true, 0, false, false)
                },
                Encoders: Array.Empty<EncoderLayout>(),
                NeoPixelPin: 34,
                NeoPixelReversed: false);

            var bindings = new BindingProfile(
                Buttons: new List<ButtonBindingEntry>
                {
                    new ButtonBindingEntry(0, new HidSequenceBinding("a", 0))
                },
                Encoders: new List<EncoderBindingEntry>());

            var ledConfig = new LedConfiguration(
                Leds: new[]
                {
                    new LedPerKey(
                        PassiveMode: PassiveLedMode.Rainbow,
                        PassiveColor: new LedColor(255, 0, 0),
                        ActiveMode: ActiveLedMode.Solid,
                        ActiveColor: new LedColor(255, 255, 255),
                        Timing: new LedTiming(20, 30, 40),
                        RainbowStepMs: 7,
                        BreathingMinPercent: 8,
                        BreathingStepMs: 9)
                },
                BrightnessPercent: 100);

            var result = Builder.FromLayout(layout, bindings, debugMode: false, ledConfig);

            Assert.That(result.LedConfig.Leds, Has.Count.EqualTo(1));
            Assert.That(result.LedConfig.Leds[0].Timing, Is.EqualTo(new LedTiming(7, 8, 9)));
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
