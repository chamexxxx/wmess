using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Authorization;
using WMess.Api.Data;
using WMess.Api.Models;

namespace WMess.Api.Services;

/// <summary>
/// Эффективные права пользователя на элемент библиотеки. Иерархия: manage ⇒ edit ⇒ view.
/// </summary>
public readonly record struct LibraryRights(bool CanView, bool CanEdit, bool CanManage);

public interface ILibraryAccessService
{
    /// <summary>
    /// Комбинирует ролевой доступ к проекту с персональными правами <see cref="LibraryPermission"/>.
    /// Требует загруженный <see cref="LibraryItem.Project"/>.
    /// </summary>
    Task<LibraryRights> GetRightsAsync(ClaimsPrincipal user, LibraryItem item, CancellationToken cancellationToken = default);
}

/// <summary>
/// Единственный источник вычисления прав на элемент библиотеки. Используется и контроллером,
/// и SignalR-хабом, чтобы логика доступа существовала ровно в одном месте.
/// </summary>
public class LibraryAccessService : ILibraryAccessService
{
    private readonly ApplicationDbContext _context;
    private readonly IAuthorizationService _authorizationService;

    public LibraryAccessService(ApplicationDbContext context, IAuthorizationService authorizationService)
    {
        _context = context;
        _authorizationService = authorizationService;
    }

    public async Task<LibraryRights> GetRightsAsync(ClaimsPrincipal user, LibraryItem item, CancellationToken cancellationToken = default)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);

        var manageProject = (await _authorizationService.AuthorizeAsync(user, item.Project, Policies.ProjectManage)).Succeeded;
        var accessProject = manageProject
            || (await _authorizationService.AuthorizeAsync(user, item.Project, Policies.ProjectAccess)).Succeeded;

        var permission = string.IsNullOrEmpty(userId)
            ? null
            : await _context.LibraryPermissions
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.LibraryItemId == item.Id && p.UserId == userId, cancellationToken);

        var canManage = manageProject || (permission?.CanManage ?? false);
        var canEdit = canManage || (permission?.CanEdit ?? false);
        var canView = canEdit || accessProject || (permission?.CanView ?? false);

        return new LibraryRights(canView, canEdit, canManage);
    }
}
