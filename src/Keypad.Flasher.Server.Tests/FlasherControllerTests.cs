using System.Text.Json;
using Keypad.Flasher.Server.Configuration;
using Keypad.Flasher.Server.Controllers;
using Keypad.Flasher.Server.Services;
using Microsoft.AspNetCore.Mvc;
using NUnit.Framework;

namespace Keypad.Flasher.Server.Tests
{
    [TestFixture]
    public class FlasherControllerTests
    {
        [Test]
        public void Post_WithNullRequest_ReturnsBadRequest()
        {
            var builder = new StubFirmwareBuilder(_ => new FirmwareBuildResult(true, new byte[] { 1 }));
            var controller = new FlasherController(builder);

            var result = controller.Post(null);

            AssertBadRequestWithError(result, "A configuration payload is required.");
            Assert.That(builder.CallCount, Is.EqualTo(0));
        }

        [Test]
        public void Post_WithDebugAndLayout_ReturnsBadRequest()
        {
            var builder = new StubFirmwareBuilder(_ => new FirmwareBuildResult(true, new byte[] { 1 }));
            var controller = new FlasherController(builder);
            var request = new FlasherController.FirmwareRequest(
                Layout: CreateMinimalLayout(),
                BindingProfile: null,
                Debug: true,
                LedConfig: null,
                DebugOptions: null);

            var result = controller.Post(request);

            AssertBadRequestWithError(result, "Debug mode must not include layout or bindingProfile.");
            Assert.That(builder.CallCount, Is.EqualTo(0));
        }

        [Test]
        public void Post_WithDebugAndBindingProfile_ReturnsBadRequest()
        {
            var builder = new StubFirmwareBuilder(_ => new FirmwareBuildResult(true, new byte[] { 1 }));
            var controller = new FlasherController(builder);
            var request = new FlasherController.FirmwareRequest(
                Layout: null,
                BindingProfile: new BindingProfile(new List<ButtonBindingEntry>(), new List<EncoderBindingEntry>()),
                Debug: true,
                LedConfig: null,
                DebugOptions: null);

            var result = controller.Post(request);

            AssertBadRequestWithError(result, "Debug mode must not include layout or bindingProfile.");
            Assert.That(builder.CallCount, Is.EqualTo(0));
        }

        [Test]
        public void Post_WithDebugOnlyRequest_UsesProvidedDebugOptionsAndReturnsFirmware()
        {
            ConfigurationDefinition? capturedConfiguration = null;
            var builder = new StubFirmwareBuilder(configuration =>
            {
                capturedConfiguration = configuration;
                return new FirmwareBuildResult(true, new byte[] { 10, 11, 12 });
            });

            var controller = new FlasherController(builder);
            var debugOptions = new DebugOptions(
                EnableNoiseFilter: false,
                EnablePullups: false,
                ConfirmSamples: 7,
                ConfirmDelayMs: 9);
            var request = new FlasherController.FirmwareRequest(
                Layout: null,
                BindingProfile: null,
                Debug: true,
                LedConfig: null,
                DebugOptions: debugOptions);

            var result = controller.Post(request);

            Assert.That(result.Result, Is.Null);
            Assert.That(result.Value, Is.Not.Null);
            Assert.That(result.Value!.FileBytes, Is.EqualTo(new byte[] { 10, 11, 12 }));

            Assert.That(capturedConfiguration, Is.Not.Null);
            Assert.That(capturedConfiguration!.DebugMode, Is.True);
            Assert.That(capturedConfiguration.Buttons, Is.Empty);
            Assert.That(capturedConfiguration.Encoders, Is.Empty);
            Assert.That(capturedConfiguration.NeoPixelPin, Is.EqualTo(-1));
            Assert.That(capturedConfiguration.LedConfig.Leds, Is.Empty);
            Assert.That(capturedConfiguration.DebugOptions, Is.EqualTo(debugOptions));
        }

        [Test]
        public void Post_WithDebugOnlyAndFailedBuild_Returns500WithErrorDetails()
        {
            var builder = new StubFirmwareBuilder(_ => new FirmwareBuildResult(
                Success: false,
                FileBytes: null,
                Error: "Compile failed",
                ExitCode: 2,
                Stdout: "out",
                Stderr: "err"));
            var controller = new FlasherController(builder);
            var request = new FlasherController.FirmwareRequest(
                Layout: null,
                BindingProfile: null,
                Debug: true,
                LedConfig: null,
                DebugOptions: null);

            var result = controller.Post(request);

            var objectResult = result.Result as ObjectResult;
            Assert.That(objectResult, Is.Not.Null);
            Assert.That(objectResult!.StatusCode, Is.EqualTo(500));
            var payload = JsonSerializer.Serialize(objectResult.Value);
            Assert.That(payload, Does.Contain("Compile failed"));
            Assert.That(payload, Does.Contain("\"exitCode\":2"));
            Assert.That(payload, Does.Contain("\"stdout\":\"out\""));
            Assert.That(payload, Does.Contain("\"stderr\":\"err\""));
        }

        [Test]
        public void Post_WithNonDebugAndMissingLayout_ReturnsBadRequest()
        {
            var builder = new StubFirmwareBuilder(_ => new FirmwareBuildResult(true, new byte[] { 1 }));
            var controller = new FlasherController(builder);
            var request = new FlasherController.FirmwareRequest(
                Layout: null,
                BindingProfile: new BindingProfile(new List<ButtonBindingEntry>(), new List<EncoderBindingEntry>()),
                Debug: false,
                LedConfig: null,
                DebugOptions: null);

            var result = controller.Post(request);

            AssertBadRequestWithError(result, "Layout and bindingProfile are required when debug is false.");
            Assert.That(builder.CallCount, Is.EqualTo(0));
        }

        [Test]
        public void Post_WithNonDebugAndMissingBindingProfile_ReturnsBadRequest()
        {
            var builder = new StubFirmwareBuilder(_ => new FirmwareBuildResult(true, new byte[] { 1 }));
            var controller = new FlasherController(builder);
            var request = new FlasherController.FirmwareRequest(
                Layout: CreateMinimalLayout(),
                BindingProfile: null,
                Debug: false,
                LedConfig: null,
                DebugOptions: null);

            var result = controller.Post(request);

            AssertBadRequestWithError(result, "Layout and bindingProfile are required when debug is false.");
            Assert.That(builder.CallCount, Is.EqualTo(0));
        }

        [Test]
        public void Post_WithNonDebugInvalidLayout_ReturnsBadRequestFromBuilderException()
        {
            var builder = new StubFirmwareBuilder(_ => new FirmwareBuildResult(true, new byte[] { 1 }));
            var controller = new FlasherController(builder);
            var request = new FlasherController.FirmwareRequest(
                Layout: CreateMinimalLayout(),
                BindingProfile: new BindingProfile(new List<ButtonBindingEntry>(), new List<EncoderBindingEntry>()),
                Debug: false,
                LedConfig: null,
                DebugOptions: null);

            var result = controller.Post(request);

            AssertBadRequestWithError(result, "Binding not found for button '0'.");
            Assert.That(builder.CallCount, Is.EqualTo(0));
        }

        [Test]
        public void Post_WithNonDebugFailedBuild_Returns500()
        {
            var builder = new StubFirmwareBuilder(_ => new FirmwareBuildResult(
                Success: false,
                FileBytes: null,
                Error: "Compile failed",
                ExitCode: 5,
                Stdout: "compile-out",
                Stderr: "compile-err"));
            var controller = new FlasherController(builder);
            var request = new FlasherController.FirmwareRequest(
                Layout: CreateMinimalLayout(),
                BindingProfile: CreateMinimalBindingProfile(),
                Debug: false,
                LedConfig: null,
                DebugOptions: null);

            var result = controller.Post(request);

            var objectResult = result.Result as ObjectResult;
            Assert.That(objectResult, Is.Not.Null);
            Assert.That(objectResult!.StatusCode, Is.EqualTo(500));
            var payload = JsonSerializer.Serialize(objectResult.Value);
            Assert.That(payload, Does.Contain("Compile failed"));
            Assert.That(payload, Does.Contain("\"exitCode\":5"));
        }

        [Test]
        public void Post_WithNonDebugSuccess_UsesDebugDefaultsAndReturnsFirmware()
        {
            ConfigurationDefinition? capturedConfiguration = null;
            var builder = new StubFirmwareBuilder(configuration =>
            {
                capturedConfiguration = configuration;
                return new FirmwareBuildResult(true, new byte[] { 42 });
            });
            var controller = new FlasherController(builder);

            var customDebugOptions = new DebugOptions(
                EnableNoiseFilter: false,
                EnablePullups: false,
                ConfirmSamples: 9,
                ConfirmDelayMs: 9);

            var request = new FlasherController.FirmwareRequest(
                Layout: CreateMinimalLayout(),
                BindingProfile: CreateMinimalBindingProfile(),
                Debug: false,
                LedConfig: null,
                DebugOptions: customDebugOptions);

            var result = controller.Post(request);

            Assert.That(result.Result, Is.Null);
            Assert.That(result.Value, Is.Not.Null);
            Assert.That(result.Value!.FileBytes, Is.EqualTo(new byte[] { 42 }));

            Assert.That(capturedConfiguration, Is.Not.Null);
            Assert.That(capturedConfiguration!.DebugMode, Is.False);
            Assert.That(capturedConfiguration.DebugOptions, Is.EqualTo(DebugOptions.Default));
        }

        private static void AssertBadRequestWithError(ActionResult<FlasherController.Firmware> actionResult, string errorMessage)
        {
            var badRequest = actionResult.Result as BadRequestObjectResult;
            Assert.That(badRequest, Is.Not.Null);
            var payload = JsonSerializer.Serialize(badRequest!.Value);
            using var payloadJson = JsonDocument.Parse(payload);
            var error = payloadJson.RootElement.GetProperty("error").GetString();
            Assert.That(error, Is.EqualTo(errorMessage));
        }

        private static DeviceLayout CreateMinimalLayout()
        {
            return new DeviceLayout(
                Buttons: new List<ButtonLayout>
                {
                    new ButtonLayout(0, 11, true, -1, false, false)
                },
                Encoders: new List<EncoderLayout>(),
                NeoPixelPin: -1,
                NeoPixelReversed: false);
        }

        private static BindingProfile CreateMinimalBindingProfile()
        {
            return new BindingProfile(
                Buttons: new List<ButtonBindingEntry>
                {
                    new ButtonBindingEntry(0, new HidSequenceBinding("a", 0))
                },
                Encoders: new List<EncoderBindingEntry>());
        }

        private sealed class StubFirmwareBuilder : IFirmwareBuilder
        {
            private readonly Func<ConfigurationDefinition, FirmwareBuildResult> _build;

            public StubFirmwareBuilder(Func<ConfigurationDefinition, FirmwareBuildResult> build)
            {
                _build = build;
            }

            public int CallCount { get; private set; }

            public FirmwareBuildResult BuildFirmware(ConfigurationDefinition configuration)
            {
                CallCount++;
                return _build(configuration);
            }
        }
    }
}