using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using System.Diagnostics;
using System.Text;

namespace Keypad.Flasher.Server.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class FlasherController : ControllerBase
    {
        private readonly Settings _settings;
        private readonly ILogger<FlasherController> _logger;

        public FlasherController(IOptions<Settings> settings, ILogger<FlasherController> logger)
        {
            _settings = settings.Value;
            _logger = logger;
        }

        [HttpGet(Name = "GetFirmware")]
        public ActionResult<Firmware> Get()
        {
            var tempPath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
            Directory.CreateDirectory(tempPath);
            try
            {
                // arduino-cli compile --fqbn CH55xDuino:mcs51:ch552:usb_settings=user148,clock=16internal --export-binaries
                var args = new ProcessStartInfo
                {
                    FileName = "arduino-cli",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    WorkingDirectory = Path.GetFullPath(_settings.FirmwarePath),
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                args.ArgumentList.Add("compile");
                args.ArgumentList.Add("--fqbn");
                args.ArgumentList.Add("CH55xDuino:mcs51:ch552:usb_settings=user148,clock=16internal");
                args.ArgumentList.Add("--config-file");
                args.ArgumentList.Add("arduino-cli.yaml");
                args.ArgumentList.Add("--export-binaries");
                args.ArgumentList.Add("--output-dir");
                args.ArgumentList.Add(tempPath);

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

                var path = Path.Combine(tempPath, "Keypad.Firmware.ino.hex");

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

        public record Firmware(byte[] FileBytes);
    }
}
