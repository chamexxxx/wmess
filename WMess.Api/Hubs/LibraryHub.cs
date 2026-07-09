using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Authorization;
using WMess.Api.Data;

namespace WMess.Api.Hubs;

/// <summary>
/// Хаб realtime-уведомлений об изменениях в библиотеке проекта (структура папок и элементов).
/// В отличие от <see cref="CollaborativeYjsHub"/>, который синхронизирует содержимое одного
/// элемента, этот хаб работает на уровне проекта: рассылает участникам лёгкий сигнал
/// «library changed», по которому клиент перезапрашивает текущий вид (список папок/элементов).
///
/// Само событие в группу шлёт HTTP-контроллер (<c>LibraryController</c>) через
/// <see cref="IHubContext{LibraryHub}"/> после успешной мутации — хаб отвечает только за
/// членство в группе проекта и его авторизацию.
///
/// ВНИМАНИЕ: имена методов (JoinProject/LeaveProject) и события (LibraryChanged) — общий
/// проводной контракт с клиентом (useLibraryLive). Менять только синхронно с клиентом.
/// </summary>
[Authorize]
public class LibraryHub : Hub
{
    private readonly ApplicationDbContext _db;
    private readonly IAuthorizationService _authorizationService;

    public LibraryHub(ApplicationDbContext db, IAuthorizationService authorizationService)
    {
        _db = db;
        _authorizationService = authorizationService;
    }

    /// <summary>Имя группы SignalR для проекта. Должно совпадать с тем, что использует контроллер.</summary>
    public static string ProjectGroup(int projectId) => $"library_project_{projectId}";

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
