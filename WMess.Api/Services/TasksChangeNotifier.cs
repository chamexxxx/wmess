using Microsoft.AspNetCore.SignalR;
using WMess.Api.Hubs;

namespace WMess.Api.Services;

public interface ITasksChangeNotifier
{
    Task NotifyChangedAsync(int teamId);
}

public class TasksChangeNotifier : ITasksChangeNotifier
{
    private readonly IHubContext<TasksHub> _hub;

    public TasksChangeNotifier(IHubContext<TasksHub> hub)
    {
        _hub = hub;
    }

    public async Task NotifyChangedAsync(int teamId)
    {
        try
        {
            await _hub.Clients.Group(TasksHub.TeamGroup(teamId))
                .SendAsync("TasksChanged", teamId);
        }
        catch
        {
            // Realtime — best-effort; на реконнекте клиент перезапросит данные.
        }
    }
}
