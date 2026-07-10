using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using WMess.Web.Models.DTO;

namespace WMess.Web.Services;

public class SessionManager : ISessionManager
{
    public const string AccessTokenName = "access_token";
    public const string RefreshTokenName = "refresh_token";
    public const string LoginClaim = "login";
    public const string DisplayNameClaim = "display_name";

    private readonly IAuthApiClient _authApiClient;

    public SessionManager(IAuthApiClient authApiClient)
    {
        _authApiClient = authApiClient;
    }

    public async Task SignInAsync(HttpContext context, ApiAuthResponse auth)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, auth.UserId),
            new(ClaimTypes.Name, auth.Login),
            new(ClaimTypes.Email, auth.Email),
            new(LoginClaim, auth.Login),
            new(DisplayNameClaim, auth.DisplayName)
        };
        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);

        var properties = new AuthenticationProperties
        {
            ExpiresUtc = DateTimeOffset.UtcNow.AddDays(30),
            IsPersistent = true
        };
        properties.StoreTokens([
            new AuthenticationToken { Name = AccessTokenName, Value = auth.Token },
            new AuthenticationToken { Name = RefreshTokenName, Value = auth.RefreshToken }
        ]);

        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal, properties);
    }

    public Task SignOutAsync(HttpContext context)
    {
        return context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    }

    public async Task<bool> RefreshAsync(HttpContext context)
    {
        var result = await context.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);

        if (!result.Succeeded) {
            return false;
        }

        var refreshToken = result.Properties!.GetTokenValue(RefreshTokenName);

        if (string.IsNullOrEmpty(refreshToken)) {
            return false;
        }

        var auth = await _authApiClient.RefreshAsync(refreshToken);

        if (auth is null) {
            return false;
        }

        result.Properties!.UpdateTokenValue(AccessTokenName, auth.Token);
        result.Properties!.UpdateTokenValue(RefreshTokenName, auth.RefreshToken);

        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, result.Principal!, result.Properties!);

        return true;
    }
}
