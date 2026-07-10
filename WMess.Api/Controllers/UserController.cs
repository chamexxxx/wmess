using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Data;
using WMess.Api.Infrastructure;
using WMess.Api.Models;
using WMess.Api.Models.DTO;

namespace WMess.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class UserController : ControllerBase
{
    // Разрешённые типы изображений для аватарки и лимит размера (2 МБ).
    private static readonly string[] AllowedAvatarTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    private const long MaxAvatarBytes = 2 * 1024 * 1024;

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _context;

    public UserController(UserManager<ApplicationUser> userManager, ApplicationDbContext context)
    {
        _userManager = userManager;
        _context = context;
    }

    [HttpGet("me")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMe()
    {
        var user = await GetCurrentUserAsync();
        if (user == null)
        {
            return Unauthorized();
        }

        return Ok(ToResponse(user));
    }

    /// <summary>
    /// Редактирование профиля текущего пользователя: email, логин и отображаемое имя.
    /// </summary>
    [HttpPut("me")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var user = await GetCurrentUserAsync();
        if (user == null)
        {
            return Unauthorized();
        }

        var login = request.Login.Trim();
        var email = request.Email.Trim();

        // Логин уникален: если он изменился, проверяем, что не занят другим пользователем.
        if (!string.Equals(login, user.UserName, StringComparison.OrdinalIgnoreCase))
        {
            var existing = await _userManager.FindByNameAsync(login);
            if (existing != null && existing.Id != user.Id)
            {
                return Conflict(new { message = "User with this login already exists", code = "LoginTaken" });
            }

            var setName = await _userManager.SetUserNameAsync(user, login);
            if (!setName.Succeeded)
            {
                return BadRequest(new { message = "Failed to update login", errors = setName.Errors.Select(e => e.Description) });
            }
        }

        // Email тоже уникален (RequireUniqueEmail): проверяем занятость при изменении.
        if (!string.Equals(email, user.Email, StringComparison.OrdinalIgnoreCase))
        {
            var existingEmail = await _userManager.FindByEmailAsync(email);
            if (existingEmail != null && existingEmail.Id != user.Id)
            {
                return Conflict(new { message = "User with this email already exists", code = "EmailTaken" });
            }

            var setEmail = await _userManager.SetEmailAsync(user, email);
            if (!setEmail.Succeeded)
            {
                return BadRequest(new { message = "Failed to update email", errors = setEmail.Errors.Select(e => e.Description) });
            }
        }

        user.DisplayName = request.DisplayName.Trim();

        var update = await _userManager.UpdateAsync(user);
        if (!update.Succeeded)
        {
            return BadRequest(new { message = "Failed to update profile", errors = update.Errors.Select(e => e.Description) });
        }

        return Ok(ToResponse(user));
    }

    /// <summary>
    /// Загрузка (замена) аватарки текущего пользователя.
    /// </summary>
    [HttpPost("me/avatar")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UploadAvatar(IFormFile file)
    {
        var user = await GetCurrentUserAsync();
        if (user == null)
        {
            return Unauthorized();
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "No file provided" });
        }

        if (file.Length > MaxAvatarBytes)
        {
            return BadRequest(new { message = "Avatar must be at most 2 MB" });
        }

        if (!AllowedAvatarTypes.Contains(file.ContentType))
        {
            return BadRequest(new { message = "Avatar must be an image (jpeg, png, gif or webp)" });
        }

        using var memory = new MemoryStream();
        await file.CopyToAsync(memory);

        user.AvatarData = memory.ToArray();
        user.AvatarContentType = file.ContentType;

        var update = await _userManager.UpdateAsync(user);
        if (!update.Succeeded)
        {
            return BadRequest(new { message = "Failed to save avatar" });
        }

        return Ok(ToResponse(user));
    }

    /// <summary>
    /// Удаление аватарки текущего пользователя.
    /// </summary>
    [HttpDelete("me/avatar")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteAvatar()
    {
        var user = await GetCurrentUserAsync();
        if (user == null)
        {
            return Unauthorized();
        }

        user.AvatarData = null;
        user.AvatarContentType = null;

        var update = await _userManager.UpdateAsync(user);
        if (!update.Succeeded)
        {
            return BadRequest(new { message = "Failed to remove avatar" });
        }

        return Ok(ToResponse(user));
    }

    /// <summary>
    /// Мягкое удаление аккаунта текущего пользователя: помечаем удалённым и отзываем
    /// refresh-токены. Запись и авторский контент (элементы библиотеки) сохраняются.
    /// </summary>
    [HttpDelete("me")]
    public async Task<IActionResult> DeleteAccount()
    {
        var user = await GetCurrentUserAsync();
        if (user == null)
        {
            return Unauthorized();
        }

        user.IsDeleted = true;
        user.DeletedAt = DateTime.UtcNow;

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            return BadRequest(new { message = "Failed to delete account", errors = result.Errors.Select(e => e.Description) });
        }

        // Отзываем активные refresh-токены, чтобы сессию нельзя было продлить после удаления.
        await _context.RefreshTokens
            .Where(rt => rt.UserId == user.Id && !rt.IsRevoked)
            .ExecuteUpdateAsync(s => s.SetProperty(rt => rt.IsRevoked, true));

        return Ok();
    }

    /// <summary>
    /// Смена пароля текущего пользователя (требует текущий пароль).
    /// </summary>
    [HttpPost("me/password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var user = await GetCurrentUserAsync();
        if (user == null)
        {
            return Unauthorized();
        }

        var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            if (result.Errors.Any(e => e.Code == "PasswordMismatch"))
            {
                return BadRequest(new { message = "Current password is incorrect", code = "PasswordMismatch" });
            }

            return BadRequest(new { message = "Failed to change password", errors = result.Errors.Select(e => e.Description) });
        }

        return Ok();
    }

    /// <summary>
    /// Отдаёт аватарку пользователя по его идентификатору (для тега img в клиенте).
    /// </summary>
    [HttpGet("{id}/avatar")]
    public async Task<IActionResult> GetAvatar(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null || user.IsDeleted || user.AvatarData == null || user.AvatarData.Length == 0)
        {
            return NotFound();
        }

        return File(user.AvatarData, user.AvatarContentType ?? "application/octet-stream");
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

        var pattern = SearchPattern.Contains(email.Trim());

        var users = await _userManager.Users
            .Where(u => !u.IsDeleted && u.Email != null && EF.Functions.ILike(u.Email, pattern, SearchPattern.EscapeChar))
            .OrderBy(u => u.Email)
            .Take(10)
            .Select(u => new UserResponse
            {
                Id = u.Id,
                Email = u.Email!,
                Login = u.UserName!,
                DisplayName = u.DisplayName,
                HasAvatar = u.AvatarData != null
            })
            .ToListAsync();

        return Ok(users);
    }

    private async Task<ApplicationUser?> GetCurrentUserAsync()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (userId == null)
        {
            return null;
        }

        var user = await _userManager.FindByIdAsync(userId);
        // Мягко удалённый пользователь считается неаутентифицированным.
        return user is { IsDeleted: false } ? user : null;
    }

    private static UserResponse ToResponse(ApplicationUser user) => new()
    {
        Id = user.Id,
        Email = user.Email!,
        Login = user.UserName!,
        DisplayName = user.DisplayName,
        HasAvatar = user.AvatarData != null && user.AvatarData.Length > 0
    };
}
