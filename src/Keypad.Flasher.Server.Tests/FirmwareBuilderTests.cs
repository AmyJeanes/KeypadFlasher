using Keypad.Flasher.Server.Configuration;
using Keypad.Flasher.Server.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NUnit.Framework;

namespace Keypad.Flasher.Server.Tests
{
    [TestFixture]
    public class FirmwareBuilderTests
    {
        [Test]
        public void BuildFirmware_WithMissingFirmwareDirectory_ThrowsDirectoryNotFoundException()
        {
            var missingPath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
            var settings = Options.Create(new Settings { FirmwarePath = missingPath });
            var generator = new ConfigurationGenerator();
            var logger = NullLogger<FirmwareBuilder>.Instance;
            var firmwareBuilder = new FirmwareBuilder(settings, generator, logger);

            var configuration = new ConfigurationDefinition(
                Buttons: Array.Empty<ButtonBinding>(),
                Encoders: Array.Empty<EncoderBinding>(),
                DebugMode: false,
                NeoPixelPin: -1,
                NeoPixelReversed: false,
                LedConfig: new LedConfiguration(Leds: Array.Empty<LedPerKey>(), BrightnessPercent: 0),
                DebugOptions: DebugOptions.Default);

            Assert.Throws<DirectoryNotFoundException>(() => firmwareBuilder.BuildFirmware(configuration));
        }
    }
}