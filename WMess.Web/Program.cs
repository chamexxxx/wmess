using WMess.Web.Extensions;
using WMess.Web.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddBff(builder.Configuration, builder.Environment);
builder.Services.AddControllers();
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer<ApiProxyDocumentTransformer>();
    options.AddDocumentTransformer<CookieSecurityDocumentTransformer>();
});

var app = builder.Build();

var serveSpa = !app.Environment.IsDevelopment() || app.Environment.IsDockerLike();

app.UseExceptionHandler();

if (serveSpa)
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

if (serveSpa)
{
    app.MapFallbackToFile("index.html");
}

app.Run();
