using WMess.Web.Extensions;
using WMess.Web.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddBff(builder.Configuration);
builder.Services.AddControllers();

var app = builder.Build();

app.UseExceptionHandler();

if (!app.Environment.IsDevelopment())
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseMiddleware<AntiforgeryHeaderMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapReverseProxy();

if (!app.Environment.IsDevelopment())
{
    app.MapFallbackToFile("index.html");
}

app.Run();
