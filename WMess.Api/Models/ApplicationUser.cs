using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace WMess.Api.Models;

/// <summary>
/// Пользователь приложения. Расширяет <see cref="IdentityUser"/> отображаемым именем
/// и аватаркой. Вход выполняется по email; <see cref="IdentityUser.UserName"/> держится
/// в синхроне с email (отдельного логина у пользователя нет).
/// </summary>
public class ApplicationUser : IdentityUser
{
    /// <summary>
    /// Отображаемое имя пользователя (может повторяться у разных пользователей).
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

    /// <summary>
    /// Мягкое удаление: пользователь помечен удалённым, но запись сохраняется (вместе с
    /// авторством контента). Такой пользователь не может войти и скрыт из поиска.
    /// </summary>
    public bool IsDeleted { get; set; }

    /// <summary>
    /// Момент мягкого удаления (UTC), либо null для активного пользователя.
    /// </summary>
    public DateTime? DeletedAt { get; set; }
}
