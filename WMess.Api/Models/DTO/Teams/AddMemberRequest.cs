using System.ComponentModel.DataAnnotations;

namespace WMess.Api.Models.DTO.Teams;

/// <summary>
/// Запрос на добавление участника в команду
/// </summary>
public class AddMemberRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
}
