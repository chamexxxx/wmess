using Microsoft.AspNetCore.Authorization;

namespace WMess.Api.Authorization;

/// <summary>
/// Requirement: пользователь является участником команды.
/// </summary>
public class TeamMemberRequirement : IAuthorizationRequirement { }

/// <summary>
/// Requirement: пользователь может управлять командой (Owner или Admin).
/// </summary>
public class TeamManageRequirement : IAuthorizationRequirement { }

/// <summary>
/// Requirement: пользователь может удалить команду (только Owner).
/// </summary>
public class TeamDeleteRequirement : IAuthorizationRequirement { }

/// <summary>
/// Requirement: пользователь может менять роли участников (только Owner).
/// </summary>
public class TeamChangeRoleRequirement : IAuthorizationRequirement { }
