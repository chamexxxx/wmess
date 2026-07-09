using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using WMess.Api.Models;
using WMess.Api.Models.DTO;
using WMess.Api.Services;

namespace WMess.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ITokenService _tokenService;

    public AuthController(UserManager<ApplicationUser> userManager, ITokenService tokenService)
    {
        _userManager = userManager;
        _tokenService = tokenService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var existingByEmail = await _userManager.FindByEmailAsync(request.Email);

        if (existingByEmail != null)
        {
            return Conflict(new { message = "User with this email already exists" });
        }

        var existingByLogin = await _userManager.FindByNameAsync(request.Login);

        if (existingByLogin != null)
        {
            return Conflict(new { message = "User with this login already exists" });
        }

        var user = new ApplicationUser
        {
            Email = request.Email,
            UserName = request.Login,
            DisplayName = request.DisplayName
        };

        var result = await _userManager.CreateAsync(user, request.Password);

        if (!result.Succeeded)
        {
            return BadRequest(new { message = "Failed to create user", errors = result.Errors.Select(e => e.Description) });
        }

        return Ok(new { message = "User registered successfully" });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var identifier = request.EmailOrLogin.Trim();

        // Вход возможен как по email, так и по логину (UserName).
        var user = identifier.Contains('@')
            ? await _userManager.FindByEmailAsync(identifier) ?? await _userManager.FindByNameAsync(identifier)
            : await _userManager.FindByNameAsync(identifier) ?? await _userManager.FindByEmailAsync(identifier);

        if (user == null || user.IsDeleted)
        {
            return Unauthorized();
        }

        var isPasswordValid = await _userManager.CheckPasswordAsync(user, request.Password);

        if (!isPasswordValid)
        {
            return Unauthorized();
        }

        var response = await BuildAuthResponseAsync(user);

        return Ok(response);
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest request)
    {
        var user = await _tokenService.ValidateRefreshTokenAsync(request.RefreshToken);

        if (user is null || user.IsDeleted)
        {
            return Unauthorized();
        }

        var response = await BuildAuthResponseAsync(user);

        return Ok(response);
    }

    private async Task<AuthResponse> BuildAuthResponseAsync(ApplicationUser user)
    {
        var token = _tokenService.GenerateToken(user);
        var refreshToken = await _tokenService.GenerateRefreshTokenAsync(user.Id);

        return new AuthResponse
        {
            Token = token,
            RefreshToken = refreshToken,
            UserId = user.Id,
            Email = user.Email!,
            Login = user.UserName!,
            DisplayName = user.DisplayName,
            HasAvatar = user.AvatarData != null && user.AvatarData.Length > 0
        };
    }
}
