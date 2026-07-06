using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Data;
using WMess.Api.Models;
using WMess.Api.Services;

namespace WMess.Api.Hubs;

/// <summary>
/// Базовый хаб совместного редактирования. Сервер выступает «тупым» реле Yjs sync-протокола:
/// сам не мержит CRDT, а пересылает апдейты/awareness между участниками группы элемента и
/// хранит снапшот состояния для холодного старта. Конкретный тип контента (документ, доска)
/// задаётся наследником через <see cref="ItemType"/>, <see cref="GroupPrefix"/> и методы
/// загрузки/сохранения снапшота.
///
/// ВНИМАНИЕ: имена hub-методов (JoinDocument, SendUpdate, SaveDocumentState и т.д.) и событий
/// (DocumentState, ReceiveUpdate…) — это общий проводной контракт. Клиентский SignalRProvider
/// один на все типы (документы и доски), поэтому имена сохраняются историческими и менять их
/// нельзя без синхронной правки клиента.
/// </summary>
[Authorize]
public abstract class CollaborativeYjsHub : Hub
{
    protected readonly ApplicationDbContext Db;
    protected readonly ILibraryAccessService LibraryAccess;
    private readonly ILogger _logger;

    protected CollaborativeYjsHub(
        ApplicationDbContext db,
        ILibraryAccessService libraryAccess,
        ILogger logger)
    {
        Db = db;
        LibraryAccess = libraryAccess;
        _logger = logger;
    }

    /// <summary>Тип элемента библиотеки, который обслуживает конкретный хаб.</summary>
    protected abstract LibraryItemType ItemType { get; }

    /// <summary>Префикс имён групп и ключей прав — уникален на тип, чтобы не пересекаться.</summary>
    protected abstract string GroupPrefix { get; }

    /// <summary>Загружает сохранённый Yjs-снапшот элемента (или null, если ещё нет).</summary>
    protected abstract Task<byte[]?> LoadSnapshotAsync(int itemId);

    /// <summary>Сохраняет Yjs-снапшот элемента и обновляет UpdatedAt. Бросает при отсутствии элемента.</summary>
    protected abstract Task SaveSnapshotAsync(int itemId, byte[] state);

    private string GetCurrentUserId()
    {
        return Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new HubException("User ID not found in token");
    }

    private string GroupName(int itemId) => $"{GroupPrefix}_{itemId}";

    private string EditRightKey(int itemId) => $"{GroupPrefix}:{itemId}:canEdit";

    /// <summary>
    /// Вычисляет права текущего пользователя на элемент через общий <see cref="ILibraryAccessService"/>.
    /// </summary>
    private async Task<LibraryRights> ResolveRightsAsync(int itemId)
    {
        var item = await Db.LibraryItems
            .Include(d => d.Project)
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == itemId && d.Type == ItemType);

        if (item == null)
        {
            throw new HubException("Item not found");
        }

        return await LibraryAccess.GetRightsAsync(Context.User!, item);
    }

    private bool CachedCanEdit(int itemId)
        => Context.Items.TryGetValue(EditRightKey(itemId), out var value) && value is true;

    /// <summary>Бросает <see cref="HubException"/>, если у соединения нет хотя бы права на просмотр.</summary>
    private async Task EnsureCanViewAsync(int itemId)
    {
        // Право на редактирование кэшируется при JoinDocument и подразумевает просмотр;
        // иначе перепроверяем доступ в БД.
        if (!CachedCanEdit(itemId) && !(await ResolveRightsAsync(itemId)).CanView)
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
        var snapshot = await LoadSnapshotAsync(documentId);

        await Clients.Caller.SendAsync("DocumentState", snapshot ?? Array.Empty<byte>());

        _logger.LogInformation("User {UserId} joined {ItemType} {ItemId} (canEdit={CanEdit})", userId, ItemType, documentId, rights.CanEdit);
    }

    public async Task LeaveDocument(int documentId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(documentId));
        Context.Items.Remove(EditRightKey(documentId));
        _logger.LogInformation("User {UserId} left {ItemType} {ItemId}", GetCurrentUserId(), ItemType, documentId);
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

    /// <summary>Инкрементальный апдейт — широковещательно остальным участникам.</summary>
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

    /// <summary>Сохраняет снапшот состояния (клиент вызывает с дебаунсом).</summary>
    public async Task SaveDocumentState(int documentId, byte[] state)
    {
        if (!CachedCanEdit(documentId))
        {
            throw new HubException("Edit access denied");
        }

        await SaveSnapshotAsync(documentId, state);

        _logger.LogDebug("{ItemType} {ItemId} snapshot saved, size: {Size}", ItemType, documentId, state.Length);
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        // Группы и Context.Items очищаются SignalR автоматически.
        // Уведомление об уходе участника идёт через awareness (клиент очищает своё состояние при disconnect).
        _logger.LogInformation("Connection {ConnectionId} disconnected", Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }
}
