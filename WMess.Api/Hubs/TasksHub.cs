using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using WMess.Api.Authorization;
using WMess.Api.Data;

namespace WMess.Api.Hubs;

/// <summary>
/// Realtime-уведомления об изменениях в трекере задач команды (задачи, колонки, группы, расписание).
/// Клиент входит в группу команды и по событию <c>TasksChanged</c> перезапрашивает данные.
/// </summary>
[Authorize]
public class TasksHub : Hub
{
    private readonly ApplicationDbContext _db;
    private readonly IAuthorizationService _authorizationService;

    public TasksHub(ApplicationDbContext db, IAuthorizationService authorizationService)
    {
        _db = db;
        _authorizationService = authorizationService;
    }

    public static string TeamGroup(int teamId) => $"tasks_team_{teamId}";

    public async Task JoinTeam(int teamId)
    {
        var team = await _db.Teams.FindAsync(teamId)
            ?? throw new HubException("Team not found");

        var result = await _authorizationService.AuthorizeAsync(Context.User!, team, Policies.TeamMember);
        if (!result.Succeeded)
        {
            throw new HubException("Access denied");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, TeamGroup(teamId));
    }

    public async Task LeaveTeam(int teamId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, TeamGroup(teamId));
    }
}
