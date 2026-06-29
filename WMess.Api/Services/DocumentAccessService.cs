using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Authorization;
using WMess.Api.Data;
using WMess.Api.Models;

namespace WMess.Api.Services;

/// <summary>
/// Эффективные права пользователя на документ. Иерархия: manage ⇒ edit ⇒ view.
/// </summary>
public readonly record struct DocumentRights(bool CanView, bool CanEdit, bool CanManage);

public interface IDocumentAccessService
{
    /// <summary>
    /// Комбинирует ролевой доступ к проекту с персональными правами <see cref="DocumentPermission"/>.
    /// Требует загруженный <see cref="Document.Project"/>.
    /// </summary>
    Task<DocumentRights> GetRightsAsync(ClaimsPrincipal user, Document document, CancellationToken cancellationToken = default);
}

/// <summary>
/// Единственный источник вычисления прав на документ. Используется и контроллером,
/// и SignalR-хабом, чтобы логика доступа существовала ровно в одном месте.
/// </summary>
public class DocumentAccessService : IDocumentAccessService
{
    private readonly ApplicationDbContext _context;
    private readonly IAuthorizationService _authorizationService;

    public DocumentAccessService(ApplicationDbContext context, IAuthorizationService authorizationService)
    {
        _context = context;
        _authorizationService = authorizationService;
    }

    public async Task<DocumentRights> GetRightsAsync(ClaimsPrincipal user, Document document, CancellationToken cancellationToken = default)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);

        var manageProject = (await _authorizationService.AuthorizeAsync(user, document.Project, Policies.ProjectManage)).Succeeded;
        var accessProject = manageProject
            || (await _authorizationService.AuthorizeAsync(user, document.Project, Policies.ProjectAccess)).Succeeded;

        var permission = string.IsNullOrEmpty(userId)
            ? null
            : await _context.DocumentPermissions
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.DocumentId == document.Id && p.UserId == userId, cancellationToken);

        var canManage = manageProject || (permission?.CanManage ?? false);
        var canEdit = canManage || (permission?.CanEdit ?? false);
        var canView = canEdit || accessProject || (permission?.CanView ?? false);

        return new DocumentRights(canView, canEdit, canManage);
    }
}
