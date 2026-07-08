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
/// ВНИМАНИЕ: имена hub-методов (JoinLibraryItem, SendUpdate, SaveLibraryItemState и т.д.) и событий
/// (LibraryItemState, ReceiveUpdate…) — это общий проводной контракт клиента и сервера. Клиентский
/// SignalRProvider один на все типы элементов библиотеки (документы, доски), поэтому имена
/// нейтральны к типу элемента. Менять их можно только синхронно с SignalRProvider в одном
/// коммите — иначе уже открытые вкладки со старым клиентом потеряют связь до перезагрузки.
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
        // Право на редактирование кэшируется при JoinLibraryItem и подразумевает просмотр;
        // иначе перепроверяем доступ в БД.
        if (!CachedCanEdit(itemId) && !(await ResolveRightsAsync(itemId)).CanView)
        {
            throw new HubException("Access denied");
        }
    }

    public async Task JoinLibraryItem(int itemId)
    {
        var userId = GetCurrentUserId();
        var rights = await ResolveRightsAsync(itemId);

        if (!rights.CanView)
        {
            throw new HubException("Access denied");
        }

        // Запоминаем права на время жизни соединения, чтобы не ходить в БД на каждый апдейт.
        Context.Items[EditRightKey(itemId)] = rights.CanEdit;

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(itemId));

        // Отправляем сохранённый снапшот как стартовую базу (важно, если пользователь зашёл первым).
        var snapshot = await LoadSnapshotAsync(itemId);

        await Clients.Caller.SendAsync("LibraryItemState", snapshot ?? Array.Empty<byte>());

        _logger.LogInformation("User {UserId} joined {ItemType} {ItemId} (canEdit={CanEdit})", userId, ItemType, itemId, rights.CanEdit);
    }

    public async Task LeaveLibraryItem(int itemId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(itemId));
        Context.Items.Remove(EditRightKey(itemId));
        _logger.LogInformation("User {UserId} left {ItemType} {ItemId}", GetCurrentUserId(), ItemType, itemId);
    }

    /// <summary>Шаг 1 sync-протокола: рассылаем вектор состояния остальным, чтобы они прислали недостающее.</summary>
    public async Task SyncStep1(int itemId, byte[] stateVector)
    {
        await EnsureCanViewAsync(itemId);

        await Clients.OthersInGroup(GroupName(itemId))
            .SendAsync("ReceiveSyncStep1", itemId, stateVector, Context.ConnectionId);
    }

    /// <summary>Шаг 2 sync-протокола: адресный ответ конкретному соединению с недостающими апдейтами.</summary>
    public async Task SyncStep2(int itemId, byte[] update, string targetConnectionId)
    {
        await EnsureCanViewAsync(itemId);

        await Clients.Client(targetConnectionId).SendAsync("ReceiveSyncStep2", itemId, update);
    }

    /// <summary>Инкрементальный апдейт — широковещательно остальным участникам.</summary>
    public async Task SendUpdate(int itemId, byte[] update)
    {
        if (!CachedCanEdit(itemId))
        {
            throw new HubException("Edit access denied");
        }

        await Clients.OthersInGroup(GroupName(itemId)).SendAsync("ReceiveUpdate", itemId, update);
    }

    /// <summary>Апдейт presence/курсоров (awareness) — широковещательно остальным участникам.</summary>
    public async Task SendAwareness(int itemId, byte[] update)
    {
        await EnsureCanViewAsync(itemId);

        await Clients.OthersInGroup(GroupName(itemId)).SendAsync("ReceiveAwareness", itemId, update);
    }

    /// <summary>Сохраняет снапшот состояния (клиент вызывает с дебаунсом).</summary>
    public async Task SaveLibraryItemState(int itemId, byte[] state)
    {
        if (!CachedCanEdit(itemId))
        {
            throw new HubException("Edit access denied");
        }

        await SaveSnapshotAsync(itemId, state);

        _logger.LogDebug("{ItemType} {ItemId} snapshot saved, size: {Size}", ItemType, itemId, state.Length);
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        // Группы и Context.Items очищаются SignalR автоматически.
        // Уведомление об уходе участника идёт через awareness (клиент очищает своё состояние при disconnect).
        _logger.LogInformation("Connection {ConnectionId} disconnected", Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }
}
