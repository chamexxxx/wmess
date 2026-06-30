using WMess.Web.Extensions;
using WMess.Web.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddBff(builder.Configuration, builder.Environment);
builder.Services.AddControllers();
builder.Services.AddSpaYarp();
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer<ApiProxyDocumentTransformer>();
    options.AddDocumentTransformer<CookieSecurityDocumentTransformer>();
});

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

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapControllers();
app.Map("/api/auth/{**rest}", () => Results.NotFound()).ExcludeFromDescription();
app.MapReverseProxy();

app.UseSpaYarp();

if (!app.Environment.IsDevelopment())
{
    app.MapFallbackToFile("index.html");
}

app.Run();
