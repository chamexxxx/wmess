using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using WMess.Api.Authorization;
using WMess.Api.Models;

namespace WMess.Api.Services;

/// <summary>
/// Эффективные права пользователя на элемент библиотеки. Иерархия: manage ⇒ edit ⇒ view.
/// </summary>
public readonly record struct LibraryRights(bool CanView, bool CanEdit, bool CanManage);

public interface ILibraryAccessService
{
    /// <summary>
    /// Вычисляет доступ к элементу по роли пользователя в команде проекта.
    /// Требует загруженный <see cref="LibraryItem.Project"/>.
    /// </summary>
    Task<LibraryRights> GetRightsAsync(ClaimsPrincipal user, LibraryItem item, CancellationToken cancellationToken = default);
}

/// <summary>
/// Единственный источник вычисления прав на элемент библиотеки. Используется и контроллером,
/// и SignalR-хабом, чтобы логика доступа существовала ровно в одном месте.
/// Доступ задаётся только на уровне команды: участник работает с содержимым (view/edit),
/// Owner/Admin дополнительно управляет элементом (переименование, перемещение, удаление).
/// </summary>
public class LibraryAccessService : ILibraryAccessService
{
    private readonly IAuthorizationService _authorizationService;

    public LibraryAccessService(IAuthorizationService authorizationService)
    {
        _authorizationService = authorizationService;
    }

    public async Task<LibraryRights> GetRightsAsync(ClaimsPrincipal user, LibraryItem item, CancellationToken cancellationToken = default)
    {
        var manageProject = (await _authorizationService.AuthorizeAsync(user, item.Project, Policies.ProjectManage)).Succeeded;
        var accessProject = manageProject
            || (await _authorizationService.AuthorizeAsync(user, item.Project, Policies.ProjectAccess)).Succeeded;

        return new LibraryRights(CanView: accessProject, CanEdit: accessProject, CanManage: manageProject);
    }
}
