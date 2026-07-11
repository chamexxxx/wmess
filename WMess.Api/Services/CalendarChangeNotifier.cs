using Microsoft.AspNetCore.SignalR;
using WMess.Api.Hubs;

namespace WMess.Api.Services;

public interface ICalendarChangeNotifier
{
    Task NotifyChangedAsync(int projectId);
}

public class CalendarChangeNotifier : ICalendarChangeNotifier
{
    private readonly IHubContext<CalendarHub> _hub;

    public CalendarChangeNotifier(IHubContext<CalendarHub> hub)
    {
        _hub = hub;
    }

    public async Task NotifyChangedAsync(int projectId)
    {
        try
        {
            await _hub.Clients.Group(CalendarHub.ProjectGroup(projectId))
                .SendAsync("CalendarChanged", projectId);
        }
        catch
        {
            // Realtime — best-effort; на реконнекте клиент перезапросит данные.
        }
    }
}
