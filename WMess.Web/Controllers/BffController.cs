using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using WMess.Web.Models.DTO;
using WMess.Web.Services;

namespace WMess.Web.Controllers;

[ApiController]
[Route("api")]
public class BffController : ControllerBase
{
    private readonly IAuthApiClient _authApiClient;
    private readonly ISessionManager _sessionManager;

    public BffController(IAuthApiClient authApiClient, ISessionManager sessionManager)
    {
        _authApiClient = authApiClient;
        _sessionManager = sessionManager;
    }

    [HttpPost("login")]
    [EndpointName("Login")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var auth = await _authApiClient.LoginAsync(request);
        if (auth is null || string.IsNullOrEmpty(auth.Token))
        {
            return Unauthorized();
        }

        await _sessionManager.SignInAsync(HttpContext, auth);
        return Ok(new UserResponse { Email = auth.Email });
    }

    [HttpPost("register")]
    [EndpointName("Register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var result = await _authApiClient.RegisterAsync(request);
        return new ContentResult
        {
            Content = result.Body,
            ContentType = "application/json",
            StatusCode = result.StatusCode
        };
    }

    [HttpPost("logout")]
    [EndpointName("Logout")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Logout()
    {
        await _sessionManager.SignOutAsync(HttpContext);
        return Ok();
    }

    [HttpGet("user")]
    [EndpointName("GetUser")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult GetUser()
    {
        if (User.Identity?.IsAuthenticated != true)
        {
            return Unauthorized();
        }

        return Ok(new UserResponse { Email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty });
    }
}
