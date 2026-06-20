using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;

namespace WMess.Web.Infrastructure;

public class CookieSecurityDocumentTransformer : IOpenApiDocumentTransformer
{
    private const string CookieSchemeName = "cookieAuth";
    private const string CsrfSchemeName = "csrf";
    private const string CsrfHeaderName = "X-CSRF";

    private static readonly string[] AnonymousPaths = ["/api/login", "/api/register"];

    private readonly IAuthenticationSchemeProvider _schemeProvider;
    private readonly IOptionsMonitor<CookieAuthenticationOptions> _cookieOptions;

    public CookieSecurityDocumentTransformer(
        IAuthenticationSchemeProvider schemeProvider,
        IOptionsMonitor<CookieAuthenticationOptions> cookieOptions)
    {
        _schemeProvider = schemeProvider;
        _cookieOptions = cookieOptions;
    }

    public async Task TransformAsync(OpenApiDocument document, OpenApiDocumentTransformerContext context, CancellationToken cancellationToken)
    {
        var schemes = await _schemeProvider.GetAllSchemesAsync();
        var cookieScheme = schemes.FirstOrDefault(scheme => scheme.HandlerType == typeof(CookieAuthenticationHandler));
        if (cookieScheme is null)
        {
            return;
        }

        var cookieName = _cookieOptions.Get(cookieScheme.Name).Cookie.Name;
        if (string.IsNullOrEmpty(cookieName))
        {
            return;
        }

        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes[CookieSchemeName] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.ApiKey,
            In = ParameterLocation.Cookie,
            Name = cookieName,
            Description = "Session cookie issued by the BFF after /bff/login."
        };
        document.Components.SecuritySchemes[CsrfSchemeName] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.ApiKey,
            In = ParameterLocation.Header,
            Name = CsrfHeaderName,
            Description = "Antiforgery header required on every BFF request."
        };

        var csrf = new OpenApiSecuritySchemeReference(CsrfSchemeName, document);
        var cookie = new OpenApiSecuritySchemeReference(CookieSchemeName, document);

        document.Security = [new OpenApiSecurityRequirement { [csrf] = new List<string>() }];

        foreach (var (path, item) in document.Paths)
        {
            if (item.Operations is null || AnonymousPaths.Contains(path, StringComparer.OrdinalIgnoreCase))
            {
                continue;
            }

            foreach (var operation in item.Operations.Values)
            {
                operation.Security =
                [
                    new OpenApiSecurityRequirement
                    {
                        [csrf] = new List<string>(),
                        [cookie] = new List<string>()
                    }
                ];
            }
        }
    }
}
