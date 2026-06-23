using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Authorization;
using WMess.Api.Data;
using WMess.Api.Models;

namespace WMess.Api.Hubs;

/// <summary>
/// Хаб совместного редактирования документов. Сервер выступает «тупым» реле
/// Yjs sync-протокола: сам не мержит CRDT, а пересылает апдейты/awareness между
/// участниками группы документа и хранит снапшот состояния для холодного старта.
/// </summary>
[Authorize]
public class DocumentHub : Hub
{
    private readonly ApplicationDbContext _context;
    private readonly IAuthorizationService _authorizationService;
    private readonly ILogger<DocumentHub> _logger;

    public DocumentHub(
        ApplicationDbContext context,
        IAuthorizationService authorizationService,
        ILogger<DocumentHub> logger)
    {
        _context = context;
        _authorizationService = authorizationService;
        _logger = logger;
    }

    private string GetCurrentUserId()
    {
        return Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new HubException("User ID not found in token");
    }

    private static string GroupName(int documentId) => $"document_{documentId}";

    private static string EditRightKey(int documentId) => $"doc:{documentId}:canEdit";

    /// <summary>
    /// Вычисляет права текущего пользователя на документ, комбинируя ролевой доступ
    /// к проекту с персональными правами <see cref="DocumentPermission"/>.
    /// Иерархия: manage ⇒ edit ⇒ view.
    /// </summary>
    private async Task<(bool CanView, bool CanEdit)> ResolveRightsAsync(int documentId)
    {
        var document = await _context.Documents
            .Include(d => d.Project)
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == documentId);

        if (document == null)
        {
            throw new HubException("Document not found");
        }

        var userId = GetCurrentUserId();
        var user = Context.User!;

        var canManageProject = (await _authorizationService.AuthorizeAsync(user, document.Project, Policies.ProjectManage)).Succeeded;
        var canAccessProject = canManageProject
            || (await _authorizationService.AuthorizeAsync(user, document.Project, Policies.ProjectAccess)).Succeeded;

        var permission = await _context.DocumentPermissions
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.DocumentId == documentId && p.UserId == userId);

        var canManage = canManageProject || (permission?.CanManage ?? false);
        var canEdit = canManage || (permission?.CanEdit ?? false);
        var canView = canEdit || canAccessProject || (permission?.CanView ?? false);

        return (canView, canEdit);
    }

    private bool CachedCanEdit(int documentId)
        => Context.Items.TryGetValue(EditRightKey(documentId), out var value) && value is true;

    public async Task JoinDocument(int documentId)
    {
        var userId = GetCurrentUserId();
        var (canView, canEdit) = await ResolveRightsAsync(documentId);

        if (!canView)
        {
            throw new HubException("Access denied");
        }

        // Запоминаем права на время жизни соединения, чтобы не ходить в БД на каждый апдейт.
        Context.Items[EditRightKey(documentId)] = canEdit;

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(documentId));

        // Отправляем сохранённый снапшот как стартовую базу (важно, если пользователь зашёл первым).
        var snapshot = await _context.Documents
            .Where(d => d.Id == documentId)
            .Select(d => d.YjsState)
            .FirstOrDefaultAsync();

        await Clients.Caller.SendAsync("DocumentState", snapshot ?? Array.Empty<byte>());

        _logger.LogInformation("User {UserId} joined document {DocumentId} (canEdit={CanEdit})", userId, documentId, canEdit);
    }

    public async Task LeaveDocument(int documentId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(documentId));
        Context.Items.Remove(EditRightKey(documentId));
        _logger.LogInformation("User {UserId} left document {DocumentId}", GetCurrentUserId(), documentId);
    }

    /// <summary>Шаг 1 sync-протокола: рассылаем вектор состояния остальным, чтобы они прислали недостающее.</summary>
    public async Task SyncStep1(int documentId, byte[] stateVector)
    {
        if (!CachedCanEdit(documentId) && !(await ResolveRightsAsync(documentId)).CanView)
        {
            throw new HubException("Access denied");
        }

        await Clients.OthersInGroup(GroupName(documentId))
            .SendAsync("ReceiveSyncStep1", documentId, stateVector, Context.ConnectionId);
    }

    /// <summary>Шаг 2 sync-протокола: адресный ответ конкретному соединению с недостающими апдейтами.</summary>
    public async Task SyncStep2(int documentId, byte[] update, string targetConnectionId)
    {
        await Clients.Client(targetConnectionId).SendAsync("ReceiveSyncStep2", documentId, update);
    }

    /// <summary>Инкрементальный апдейт документа — широковещательно остальным участникам.</summary>
    public async Task SendUpdate(int documentId, byte[] update)
    {
        if (!CachedCanEdit(documentId))
        {
            throw new HubException("Edit access denied");
        }

        await Clients.OthersInGroup(GroupName(documentId)).SendAsync("ReceiveUpdate", documentId, update);
    }

    /// <summary>Апдейт presence/курсоров (awareness) — широковещательно остальным участникам.</summary>
    public async Task SendAwareness(int documentId, byte[] update)
    {
        await Clients.OthersInGroup(GroupName(documentId)).SendAsync("ReceiveAwareness", documentId, update);
    }

    /// <summary>Сохраняет снапшот состояния документа (клиент вызывает с дебаунсом).</summary>
    public async Task SaveDocumentState(int documentId, byte[] state)
    {
        if (!CachedCanEdit(documentId))
        {
            throw new HubException("Edit access denied");
        }

        var document = await _context.Documents.FirstOrDefaultAsync(d => d.Id == documentId);
        if (document == null)
        {
            throw new HubException("Document not found");
        }

        document.YjsState = state;
        document.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _logger.LogDebug("Document {DocumentId} snapshot saved, size: {Size}", documentId, state.Length);
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        // Группы и Context.Items очищаются SignalR автоматически.
        // Уведомление об уходе участника идёт через awareness (клиент очищает своё состояние при disconnect).
        _logger.LogInformation("Connection {ConnectionId} disconnected", Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }
}
