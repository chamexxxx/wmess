using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Models.DTO;

namespace WMess.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class UserController : ControllerBase
{
    private readonly UserManager<IdentityUser> _userManager;

    public UserController(UserManager<IdentityUser> userManager)
    {
        _userManager = userManager;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (userId == null)
        {
            return Unauthorized();
        }

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        var response = new UserResponse
        {
            Id = user.Id,
            Email = user.Email!
        };

        return Ok(response);
    }

    /// <summary>
    /// Поиск пользователей по email (подстрока) — для выдачи доступа к документам.
    /// </summary>
    [HttpGet("search")]
    [EndpointName("SearchUsers")]
    public async Task<ActionResult<IEnumerable<UserResponse>>> SearchUsers([FromQuery] string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return Ok(Array.Empty<UserResponse>());
        }

        var term = email.Trim();

        var users = await _userManager.Users
            .Where(u => u.Email != null && u.Email.Contains(term))
            .OrderBy(u => u.Email)
            .Take(10)
            .Select(u => new UserResponse { Id = u.Id, Email = u.Email! })
            .ToListAsync();

        return Ok(users);
    }
}
