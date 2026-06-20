namespace WMess.Web.Infrastructure;

public class AntiforgeryHeaderMiddleware
{
    public const string HeaderName = "X-CSRF";

    private readonly RequestDelegate _next;

    public AntiforgeryHeaderMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path;

        if (path.StartsWithSegments("/api") && !context.Request.Headers.ContainsKey(HeaderName))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        await _next(context);
    }
}
