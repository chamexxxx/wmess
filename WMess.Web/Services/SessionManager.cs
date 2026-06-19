using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using WMess.Web.Models.DTO;

namespace WMess.Web.Services;

public class SessionManager : ISessionManager
{
    public const string AccessTokenName = "access_token";

    public async Task SignInAsync(HttpContext context, ApiAuthResponse auth)
    {
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(auth.Token);

        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, auth.Email),
            new(ClaimTypes.Email, auth.Email)
        };
        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);

        var properties = new AuthenticationProperties
        {
            ExpiresUtc = jwt.ValidTo,
            IsPersistent = false
        };
        properties.StoreTokens([new AuthenticationToken { Name = AccessTokenName, Value = auth.Token }]);

        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal, properties);
    }

    public Task SignOutAsync(HttpContext context)
    {
        return context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    }
}
