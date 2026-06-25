namespace WMess.Api.Models.DTO.Teams;

/// <summary>
/// Готовые права текущего пользователя в команде. Считаются на сервере из его роли
/// (<see cref="WMess.Api.Authorization.TeamRoleRules"/>), чтобы клиент не дублировал логику.
/// </summary>
public class TeamPermissions
{
    /// <summary>Переименование команды, управление проектами, добавление участников (Owner/Admin).</summary>
    public bool CanManage { get; set; }

    /// <summary>Удаление команды (только Owner).</summary>
    public bool CanDelete { get; set; }

    /// <summary>Смена ролей участников (только Owner).</summary>
    public bool CanChangeRoles { get; set; }

    /// <summary>Удаление участников с ролью «Участник».</summary>
    public bool CanRemoveMembers { get; set; }

    /// <summary>Удаление участников с ролью «Админ».</summary>
    public bool CanRemoveAdmins { get; set; }

    /// <summary>Удаление участников с ролью «Владелец».</summary>
    public bool CanRemoveOwners { get; set; }
}
