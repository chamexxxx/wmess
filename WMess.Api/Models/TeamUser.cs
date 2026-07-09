using WMess.Api.Enums;

namespace WMess.Api.Models;

public class TeamUser
{
    public int TeamId { get; set; }
    public string UserId { get; set; } = string.Empty;
    
    /// <summary>
    /// Роль пользователя в команде
    /// </summary>
    public TeamRole Role { get; set; } = TeamRole.Member;

    // Навигационные свойства
    public Team Team { get; set; } = null!;
    public ApplicationUser User { get; set; } = null!;
}
