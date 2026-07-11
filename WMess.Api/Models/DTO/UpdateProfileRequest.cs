using System.ComponentModel.DataAnnotations;

namespace WMess.Api.Models.DTO;

public class UpdateProfileRequest
{
    [Required(ErrorMessage = "Name is required")]
    [MaxLength(100, ErrorMessage = "Name must be at most 100 characters")]
    public string DisplayName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email format")]
    public string Email { get; set; } = string.Empty;
}
