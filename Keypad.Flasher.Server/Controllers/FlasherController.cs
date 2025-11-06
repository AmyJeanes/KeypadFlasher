using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using System.Diagnostics;

namespace Keypad.Flasher.Server.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class FlasherController : ControllerBase
    {
		private readonly Settings _settings;

		public FlasherController(IOptions<Settings> settings)
        {
            _settings = settings.Value;
        }

        [HttpGet(Name = "GetFirmware")]
        public Firmware Get()
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
                args.ArgumentList.Add("--export-binaries");
                args.ArgumentList.Add("--output-dir");
                args.ArgumentList.Add(tempPath);
                using (var process = Process.Start(args))
                {
                    if (process == null)
                    {
                        throw new Exception("Failed to start arduino-cli process.");
                    }
                    process.WaitForExit();
                }
                var path = Path.Combine(tempPath, "Keypad.Firmware.ino.hex");

                var fileBytes = System.IO.File.ReadAllBytes(path);

                return new Firmware(fileBytes);
            }
            finally
            {
                Directory.Delete(tempPath, true);
            }
        }

        public record Firmware(byte[] FileBytes);
    }
}
