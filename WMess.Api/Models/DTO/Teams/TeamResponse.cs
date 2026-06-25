using WMess.Api.Enums;

namespace WMess.Api.Models.DTO.Teams;

public class TeamResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// Роль текущего пользователя в этой команде — чтобы клиент мог скрывать
    /// управляющие действия, на которые у пользователя нет прав.
    /// </summary>
    public TeamRole Role { get; set; }
}
