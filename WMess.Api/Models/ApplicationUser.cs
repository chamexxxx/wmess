using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace WMess.Api.Models;

/// <summary>
/// Пользователь приложения. Расширяет <see cref="IdentityUser"/> отображаемым именем
/// и аватаркой. Логин пользователя — это <see cref="IdentityUser.UserName"/>
/// (уникальный, задаётся при регистрации). Вход возможен по логину или email.
/// </summary>
public class ApplicationUser : IdentityUser
{
    /// <summary>
    /// Отображаемое имя (может повторяться у разных пользователей, в отличие от логина).
    /// </summary>
    [MaxLength(100)]
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>
    /// Байты загруженной аватарки. Null, если пользователь её не загружал —
    /// тогда клиент показывает плитку с инициалами.
    /// </summary>
    public byte[]? AvatarData { get; set; }

    /// <summary>
    /// MIME-тип аватарки (для корректной отдачи через <c>GET /api/user/{id}/avatar</c>).
    /// </summary>
    [MaxLength(100)]
    public string? AvatarContentType { get; set; }
}
