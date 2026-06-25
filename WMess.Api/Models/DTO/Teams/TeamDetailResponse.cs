namespace WMess.Api.Models.DTO.Teams;

/// <summary>
/// Подробности команды для её страницы — включают готовые права текущего пользователя.
/// Список команд (<see cref="TeamResponse"/>) остаётся лёгким, без прав.
/// </summary>
public class TeamDetailResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public TeamPermissions Permissions { get; set; } = new();
}
