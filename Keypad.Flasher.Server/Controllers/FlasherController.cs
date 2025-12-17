using System.Diagnostics;
using System.Text;
using Keypad.Flasher.Server.Configuration;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Keypad.Flasher.Server.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class FlasherController : ControllerBase
    {
        private readonly Settings _settings;
        private readonly ILogger<FlasherController> _logger;
        private static readonly object _compileLock = new(); // serialize firmware builds across requests
        private static readonly ConfigurationGenerator _configurationGenerator = new();

        public FlasherController(IOptions<Settings> settings, ILogger<FlasherController> logger)
        {
            _settings = settings.Value;
            _logger = logger;
        }

        [HttpGet(Name = "GetFirmware")]
        public ActionResult<Firmware> Get()
        {
            var firmwarePath = Path.GetFullPath(_settings.FirmwarePath);
            var tempPath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
            lock (_compileLock)
            {
                Directory.CreateDirectory(tempPath);
                var workingFirmwarePath = Path.Combine(tempPath, "Keypad.Firmware");
                CopyDirectory(firmwarePath, workingFirmwarePath);
                var outputPath = Path.Combine(tempPath, "output");

                var configuration = CreateDefaultConfiguration();
                if (IsDebugRequested())
                {
                    configuration = configuration with { DebugMode = true };
                }
                var fqbn = configuration.DebugMode
                    ? "CH55xDuino:mcs51:ch552:usb_settings=usbcdc,clock=16internal"
                    : "CH55xDuino:mcs51:ch552:usb_settings=user148,clock=16internal";
                var headerPath = Path.Combine(workingFirmwarePath, "configuration.h");
                var sourcePath = Path.Combine(workingFirmwarePath, "configuration.c");
                System.IO.File.WriteAllText(headerPath, _configurationGenerator.GenerateHeader(configuration));
                System.IO.File.WriteAllText(sourcePath, _configurationGenerator.GenerateSource(configuration));

                Directory.CreateDirectory(outputPath);
                try
                {
                    // arduino-cli compile --fqbn CH55xDuino:mcs51:ch552:usb_settings=user148,clock=16internal --export-binaries
                    var args = new ProcessStartInfo
                    {
                        FileName = "arduino-cli",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        WorkingDirectory = workingFirmwarePath,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };
                    args.ArgumentList.Add("compile");
                    args.ArgumentList.Add("--fqbn");
                    args.ArgumentList.Add(fqbn);
                    args.ArgumentList.Add("--config-file");
                    args.ArgumentList.Add("arduino-cli.yaml");
                    args.ArgumentList.Add("--export-binaries");
                    args.ArgumentList.Add("--output-dir");
                    args.ArgumentList.Add(outputPath);

                    var stdout = new StringBuilder();
                    var stderr = new StringBuilder();

                    using (var process = Process.Start(args))
                    {
                        if (process == null)
                        {
                            _logger.LogError("Failed to start arduino-cli process.");
                            return StatusCode(500, new { error = "Failed to start arduino-cli process." });
                        }

                        process.OutputDataReceived += (_, e) => { if (e.Data != null) stdout.AppendLine(e.Data); };
                        process.ErrorDataReceived += (_, e) => { if (e.Data != null) stderr.AppendLine(e.Data); };
                        process.BeginOutputReadLine();
                        process.BeginErrorReadLine();

                        process.WaitForExit();

                        if (process.ExitCode != 0)
                        {
                            _logger.LogError("arduino-cli compile failed. ExitCode: {ExitCode}\nStdOut:\n{StdOut}\nStdErr:\n{StdErr}", process.ExitCode, stdout.ToString(), stderr.ToString());
                            return StatusCode(500, new
                            {
                                error = "Compile failed",
                                exitCode = process.ExitCode,
                                stdout = stdout.ToString(),
                                stderr = stderr.ToString()
                            });
                        }

                        _logger.LogInformation("arduino-cli compile succeeded. ExitCode: {ExitCode}\nStdOut:\n{StdOut}", process.ExitCode, stdout.ToString());
                    }

                    var path = Path.Combine(outputPath, "Keypad.Firmware.ino.hex");

                    if (!System.IO.File.Exists(path))
                    {
                        _logger.LogError("Compiled firmware file not found at {Path}", path);
                        return StatusCode(500, new { error = "Compiled firmware file not found." });
                    }

                    var fileBytes = System.IO.File.ReadAllBytes(path);

                    return new Firmware(fileBytes);
                }
                finally
                {
                    try
                    {
                        Directory.Delete(tempPath, true);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to cleanup temp directory {TempPath}", tempPath);
                    }
                }
            }
        }

        public record Firmware(byte[] FileBytes);

        internal static ConfigurationDefinition CreateDefaultConfiguration()
        {
            var buttons = new List<ButtonBinding>{
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
                    BootloaderOnBoot: true,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("1", 0)),
                new ButtonBinding(
                    Pin: 15,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: true,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("2", 0)),
                new ButtonBinding(
                    Pin: 16,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: true,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("3", 0)),
                new ButtonBinding(
                    Pin: 17,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: true,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("4", 0)),
                new ButtonBinding(
                    Pin: 31,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: true,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("5", 0)),
                new ButtonBinding(
                    Pin: 30,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: true,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("6", 0)),
                new ButtonBinding(
                    Pin: 11,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: true,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("7", 0)),
                new ButtonBinding(
                    Pin: 33,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: true,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("8", 0)),
                new ButtonBinding(
                    Pin: 34,
                    ActiveLow: true,
                    LedIndex: -1,
                    BootloaderOnBoot: true,
                    BootloaderChordMember: true,
                    Function: new HidSequenceBinding("9", 0)),
            };

            return new ConfigurationDefinition(buttons, Array.Empty<EncoderBinding>(), DebugMode: false, NeoPixelPin: -1);
        }

        private bool IsDebugRequested()
        {
            if (!Request.Query.TryGetValue("debug", out var values))
            {
                return false;
            }

            foreach (var value in values)
            {
                if (string.Equals(value, "1", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(value, "true", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(value, "yes", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }

        private static void CopyDirectory(string sourceDir, string destinationDir)
        {
            if (!Directory.Exists(sourceDir))
            {
                throw new DirectoryNotFoundException($"Source directory not found: {sourceDir}");
            }

            Directory.CreateDirectory(destinationDir);

            var options = new EnumerationOptions
            {
                RecurseSubdirectories = true,
                IgnoreInaccessible = false
            };

            foreach (var directoryPath in Directory.EnumerateDirectories(sourceDir, "*", options))
            {
                var relativePath = Path.GetRelativePath(sourceDir, directoryPath);
                Directory.CreateDirectory(Path.Combine(destinationDir, relativePath));
            }

            foreach (var filePath in Directory.EnumerateFiles(sourceDir, "*", options))
            {
                var relativePath = Path.GetRelativePath(sourceDir, filePath);
                var targetPath = Path.Combine(destinationDir, relativePath);
                var targetDirectory = Path.GetDirectoryName(targetPath);
                if (!string.IsNullOrEmpty(targetDirectory))
                {
                    Directory.CreateDirectory(targetDirectory);
                }

                System.IO.File.Copy(filePath, targetPath, overwrite: true);
            }
        }
    }
}
