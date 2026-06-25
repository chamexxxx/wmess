using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Data;
using WMess.Api.Enums;
using WMess.Api.Models;

namespace WMess.Api.Authorization;

/// <summary>
/// Базовый класс для resource-based handler'ов команды: достаёт роль текущего
/// пользователя в команде и передаёт её в конкретный обработчик.
/// </summary>
public abstract class TeamAuthorizationHandler<TRequirement> : AuthorizationHandler<TRequirement, Team>
    where TRequirement : IAuthorizationRequirement
{
    private readonly ApplicationDbContext _context;

    protected TeamAuthorizationHandler(ApplicationDbContext context)
    {
        _context = context;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        TRequirement requirement,
        Team resource)
    {
        var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return;
        }

        var role = await _context.TeamUsers
            .Where(tu => tu.TeamId == resource.Id && tu.UserId == userId)
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

/// <summary>Handler: участник команды (любая роль).</summary>
public class TeamMemberHandler : TeamAuthorizationHandler<TeamMemberRequirement>
{
    public TeamMemberHandler(ApplicationDbContext context) : base(context) { }

    protected override bool IsAuthorized(TeamRole? role) => TeamRoleRules.IsMember(role);
}

/// <summary>Handler: управление командой (Owner или Admin).</summary>
public class TeamManageHandler : TeamAuthorizationHandler<TeamManageRequirement>
{
    public TeamManageHandler(ApplicationDbContext context) : base(context) { }

    protected override bool IsAuthorized(TeamRole? role) => TeamRoleRules.CanManage(role);
}

/// <summary>Handler: удаление команды (только Owner).</summary>
public class TeamDeleteHandler : TeamAuthorizationHandler<TeamDeleteRequirement>
{
    public TeamDeleteHandler(ApplicationDbContext context) : base(context) { }

    protected override bool IsAuthorized(TeamRole? role) => TeamRoleRules.CanDelete(role);
}

/// <summary>Handler: смена ролей участников (только Owner).</summary>
public class TeamChangeRoleHandler : TeamAuthorizationHandler<TeamChangeRoleRequirement>
{
    public TeamChangeRoleHandler(ApplicationDbContext context) : base(context) { }

    protected override bool IsAuthorized(TeamRole? role) => TeamRoleRules.CanChangeRoles(role);
}
