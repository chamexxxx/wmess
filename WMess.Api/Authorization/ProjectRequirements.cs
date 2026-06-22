using Microsoft.AspNetCore.Authorization;

namespace WMess.Api.Authorization;

/// <summary>
/// Requirement: пользователь имеет доступ к проекту (участник команды проекта).
/// </summary>
public class ProjectAccessRequirement : IAuthorizationRequirement { }

/// <summary>
/// Requirement: пользователь может управлять проектом (Owner или Admin в команде проекта).
/// </summary>
public class ProjectManageRequirement : IAuthorizationRequirement { }
