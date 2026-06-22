namespace WMess.Api.Authorization;

/// <summary>
/// Имена политик авторизации, основанных на ресурсах (команда / проект).
/// </summary>
public static class Policies
{
    /// <summary>Доступ участника команды (любая роль).</summary>
    public const string TeamMember = "TeamMember";

    /// <summary>Управление командой и её содержимым (Owner или Admin).</summary>
    public const string TeamManage = "TeamManage";

    /// <summary>Удаление команды (только Owner).</summary>
    public const string TeamDelete = "TeamDelete";

    /// <summary>Изменение ролей участников (только Owner).</summary>
    public const string TeamChangeRole = "TeamChangeRole";

    /// <summary>Доступ к проекту (участник команды проекта).</summary>
    public const string ProjectAccess = "ProjectAccess";

    /// <summary>Управление проектом (Owner или Admin в команде проекта).</summary>
    public const string ProjectManage = "ProjectManage";
}
