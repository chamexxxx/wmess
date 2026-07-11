using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using WMess.Api.Authorization;
using WMess.Api.Data;

namespace WMess.Api.Hubs;

/// <summary>
/// Realtime-уведомления об изменениях календаря проекта.
/// Клиент входит в группу проекта и по событию <c>CalendarChanged</c> перезапрашивает данные.
/// </summary>
[Authorize]
public class CalendarHub : Hub
{
    private readonly ApplicationDbContext _db;
    private readonly IAuthorizationService _authorizationService;

    public CalendarHub(ApplicationDbContext db, IAuthorizationService authorizationService)
    {
        _db = db;
        _authorizationService = authorizationService;
    }

    public static string ProjectGroup(int projectId) => $"calendar_project_{projectId}";

    public async Task JoinProject(int projectId)
    {
        var project = await _db.Projects.FindAsync(projectId)
            ?? throw new HubException("Project not found");

        var result = await _authorizationService.AuthorizeAsync(Context.User!, project, Policies.ProjectAccess);
        if (!result.Succeeded)
        {
            throw new HubException("Access denied");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, ProjectGroup(projectId));
    }

    public async Task LeaveProject(int projectId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, ProjectGroup(projectId));
    }
}
