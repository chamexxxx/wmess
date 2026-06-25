using WMess.Api.Enums;

namespace WMess.Api.Authorization;

/// <summary>
/// Единственный источник правил «роль → права». Используется и authorization-handler'ами
/// (которые реально защищают эндпоинты), и при формировании permission-флагов в ответах API,
/// чтобы логика прав существовала ровно в одном месте и клиент её не дублировал.
/// </summary>
public static class TeamRoleRules
{
    /// <summary>Участник команды (любая роль).</summary>
    public static bool IsMember(TeamRole? role) => role is not null;

    /// <summary>Управление командой и проектами (Owner или Admin).</summary>
    public static bool CanManage(TeamRole? role) => role is TeamRole.Owner or TeamRole.Admin;

    /// <summary>Удаление команды (только Owner).</summary>
    public static bool CanDelete(TeamRole? role) => role is TeamRole.Owner;

    /// <summary>Смена ролей участников (только Owner).</summary>
    public static bool CanChangeRoles(TeamRole? role) => role is TeamRole.Owner;

    /// <summary>
    /// Может ли пользователь с ролью <paramref name="actorRole"/> удалить ДРУГОГО участника
    /// с ролью <paramref name="targetRole"/>. Выход из команды (удаление себя) разрешён всегда
    /// и проверяется отдельно. Owner удаляет любого; Admin — только обычных участников.
    /// </summary>
    public static bool CanRemoveMember(TeamRole? actorRole, TeamRole targetRole)
    {
        if (actorRole is TeamRole.Owner) return true;
        if (actorRole is TeamRole.Admin) return targetRole == TeamRole.Member;
        return false;
    }
}
