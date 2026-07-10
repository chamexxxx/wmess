using System.ComponentModel.DataAnnotations;

namespace WMess.Web.Models.DTO;

public class RegisterRequest
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email format")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Login is required")]
    [RegularExpression("^[a-zA-Z0-9_-]{3,32}$", ErrorMessage = "Login must be 3-32 characters: letters, digits, '_' or '-'")]
    public string Login { get; set; } = string.Empty;

    [Required(ErrorMessage = "Name is required")]
    [MaxLength(100, ErrorMessage = "Name must be at most 100 characters")]
    public string DisplayName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required")]
    [MinLength(6, ErrorMessage = "Password must be at least 6 characters")]
    public string Password { get; set; } = string.Empty;
}
