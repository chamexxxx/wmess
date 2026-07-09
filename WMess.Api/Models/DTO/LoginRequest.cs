using System.ComponentModel.DataAnnotations;

namespace WMess.Api.Models.DTO;

public class LoginRequest
{
    /// <summary>
    /// Email или логин пользователя — вход возможен по любому из них.
    /// </summary>
    [Required(ErrorMessage = "Email or login is required")]
    public string EmailOrLogin { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required")]
    public string Password { get; set; } = string.Empty;
}
