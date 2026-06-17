using Microsoft.AspNetCore.Identity;

namespace WMess.Api.Models;

public class TeamUser
{
    public int TeamId { get; set; }
    public string UserId { get; set; } = string.Empty;

    // Навигационные свойства
    public Team Team { get; set; } = null!;
    public IdentityUser User { get; set; } = null!;
}
