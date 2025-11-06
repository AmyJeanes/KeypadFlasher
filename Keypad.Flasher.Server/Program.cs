using Keypad.Flasher.Server;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
builder.Services.AddHealthChecks();
builder.Services.Configure<Settings>(builder.Configuration.GetSection("Settings"));

var app = builder.Build();

app.UseDefaultFiles();
app.MapStaticAssets();

app.UseHealthChecks(new PathString("/healthz"));

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.MapFallbackToFile("/index.html");

app.Run();
