using WMess.Api.Enums;

namespace WMess.Api.Models.DTO.Teams;

/// <summary>
/// Информация об участнике команды
/// </summary>
public class TeamMemberResponse
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public bool HasAvatar { get; set; }
    public TeamRole Role { get; set; }
}
