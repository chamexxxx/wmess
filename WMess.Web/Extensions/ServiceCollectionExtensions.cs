using Microsoft.AspNetCore.Authentication.Cookies;
using WMess.Web.Infrastructure;
using WMess.Web.Services;

namespace WMess.Web.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddBff(this IServiceCollection services, IConfiguration configuration, IWebHostEnvironment environment)
    {
        services
            .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                // В Development разрешаем доступ по локальной сети (http://<ip>:5173).
                // Префикс __Host- и флаг Secure требуют secure-context/HTTPS (localhost — исключение),
                // поэтому для dev их снимаем; в production остаётся строгий вариант.
                var insecureCookies = configuration.GetValue("Bff:InsecureCookies", false)
                    || environment.IsDevelopment()
                    || environment.IsDockerLike();
                options.Cookie.Name = insecureCookies ? "session" : "__Host-session";
                options.Cookie.HttpOnly = true;
                options.Cookie.SecurePolicy = insecureCookies
                    ? CookieSecurePolicy.SameAsRequest
                    : CookieSecurePolicy.Always;
                options.Cookie.SameSite = insecureCookies ? SameSiteMode.Lax : SameSiteMode.Strict;
                options.Cookie.Path = "/";
                options.SlidingExpiration = false;
                options.Events.OnRedirectToLogin = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                options.Events.OnRedirectToAccessDenied = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                };
            });

        services.AddAuthorization();

        services.AddHttpClient<IAuthApiClient, AuthApiClient>(client =>
        {
            client.BaseAddress = new Uri(configuration["Api:BaseUrl"]!);
        });

        services.AddScoped<ISessionManager, SessionManager>();

        services
            .AddReverseProxy()
            .LoadFromConfig(configuration.GetSection("ReverseProxy"))
            .AddTransforms<AccessTokenTransformProvider>();

        services.AddExceptionHandler<UpstreamExceptionHandler>();
        services.AddProblemDetails();

        return services;
    }
}
