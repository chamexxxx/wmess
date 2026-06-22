using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Data;
using WMess.Api.Enums;
using WMess.Api.Models;

namespace WMess.Api.Authorization;

/// <summary>
/// Базовый класс для resource-based handler'ов проекта: достаёт роль текущего
/// пользователя в команде проекта и передаёт её в конкретный обработчик.
/// </summary>
public abstract class ProjectAuthorizationHandler<TRequirement> : AuthorizationHandler<TRequirement, Project>
    where TRequirement : IAuthorizationRequirement
{
    private readonly ApplicationDbContext _context;

    protected ProjectAuthorizationHandler(ApplicationDbContext context)
    {
        _context = context;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        TRequirement requirement,
        Project resource)
    {
        var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return;
        }

        var role = await _context.TeamUsers
            .Where(tu => tu.TeamId == resource.TeamId && tu.UserId == userId)
            .Select(tu => (TeamRole?)tu.Role)
            .FirstOrDefaultAsync();

        if (IsAuthorized(role))
        {
            context.Succeed(requirement);
        }
    }

    /// <summary>
    /// Возвращает true, если роль пользователя (или её отсутствие) удовлетворяет требованию.
    /// </summary>
    protected abstract bool IsAuthorized(TeamRole? role);
}

/// <summary>Handler: доступ к проекту (участник команды).</summary>
public class ProjectAccessHandler : ProjectAuthorizationHandler<ProjectAccessRequirement>
{
    public ProjectAccessHandler(ApplicationDbContext context) : base(context) { }

    protected override bool IsAuthorized(TeamRole? role) => role is not null;
}

/// <summary>Handler: управление проектом (Owner или Admin в команде).</summary>
public class ProjectManageHandler : ProjectAuthorizationHandler<ProjectManageRequirement>
{
    public ProjectManageHandler(ApplicationDbContext context) : base(context) { }

    protected override bool IsAuthorized(TeamRole? role)
        => role is TeamRole.Owner or TeamRole.Admin;
}
