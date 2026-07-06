using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Data;
using WMess.Api.Models;
using WMess.Api.Services;

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
    private readonly ILibraryAccessService _libraryAccess;
    private readonly ILogger<DocumentHub> _logger;

    public DocumentHub(
        ApplicationDbContext context,
        ILibraryAccessService libraryAccess,
        ILogger<DocumentHub> logger)
    {
        _context = context;
        _libraryAccess = libraryAccess;
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
    /// Вычисляет права текущего пользователя на документ через общий <see cref="ILibraryAccessService"/>.
    /// </summary>
    private async Task<LibraryRights> ResolveRightsAsync(int documentId)
    {
        var document = await _context.LibraryItems
            .Include(d => d.Project)
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == documentId && d.Type == LibraryItemType.Document);

        if (document == null)
        {
            throw new HubException("Document not found");
        }

        return await _libraryAccess.GetRightsAsync(Context.User!, document);
    }

    private bool CachedCanEdit(int documentId)
        => Context.Items.TryGetValue(EditRightKey(documentId), out var value) && value is true;

    /// <summary>Бросает <see cref="HubException"/>, если у соединения нет хотя бы права на просмотр документа.</summary>
    private async Task EnsureCanViewAsync(int documentId)
    {
        // Право на редактирование кэшируется при JoinDocument и подразумевает просмотр;
        // иначе перепроверяем доступ в БД.
        if (!CachedCanEdit(documentId) && !(await ResolveRightsAsync(documentId)).CanView)
        {
            throw new HubException("Access denied");
        }
    }

    public async Task JoinDocument(int documentId)
    {
        var userId = GetCurrentUserId();
        var rights = await ResolveRightsAsync(documentId);

        if (!rights.CanView)
        {
            throw new HubException("Access denied");
        }

        // Запоминаем права на время жизни соединения, чтобы не ходить в БД на каждый апдейт.
        Context.Items[EditRightKey(documentId)] = rights.CanEdit;

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(documentId));

        // Отправляем сохранённый снапшот как стартовую базу (важно, если пользователь зашёл первым).
        var snapshot = await _context.DocumentContents
            .Where(c => c.LibraryItemId == documentId)
            .Select(c => c.YjsState)
            .FirstOrDefaultAsync();

        await Clients.Caller.SendAsync("DocumentState", snapshot ?? Array.Empty<byte>());

        _logger.LogInformation("User {UserId} joined document {DocumentId} (canEdit={CanEdit})", userId, documentId, rights.CanEdit);
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
        await EnsureCanViewAsync(documentId);

        await Clients.OthersInGroup(GroupName(documentId))
            .SendAsync("ReceiveSyncStep1", documentId, stateVector, Context.ConnectionId);
    }

    /// <summary>Шаг 2 sync-протокола: адресный ответ конкретному соединению с недостающими апдейтами.</summary>
    public async Task SyncStep2(int documentId, byte[] update, string targetConnectionId)
    {
        await EnsureCanViewAsync(documentId);

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
        await EnsureCanViewAsync(documentId);

        await Clients.OthersInGroup(GroupName(documentId)).SendAsync("ReceiveAwareness", documentId, update);
    }

    /// <summary>Сохраняет снапшот состояния документа (клиент вызывает с дебаунсом).</summary>
    public async Task SaveDocumentState(int documentId, byte[] state)
    {
        if (!CachedCanEdit(documentId))
        {
            throw new HubException("Edit access denied");
        }

        var document = await _context.LibraryItems
            .Include(d => d.DocumentContent)
            .FirstOrDefaultAsync(d => d.Id == documentId && d.Type == LibraryItemType.Document);
        if (document == null)
        {
            throw new HubException("Document not found");
        }

        if (document.DocumentContent == null)
        {
            document.DocumentContent = new DocumentContent { LibraryItemId = document.Id };
            _context.DocumentContents.Add(document.DocumentContent);
        }

        document.DocumentContent.YjsState = state;
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
