using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using WMess.Api.Data;
using WMess.Api.Models;
using WMess.Api.Services;

namespace WMess.Api.Hubs;

/// <summary>
/// Хаб совместного редактирования таблиц (<see cref="LibraryItemType.Table"/>).
/// Всё реле Yjs-протокола — в базовом <see cref="CollaborativeYjsHub"/>; здесь только
/// тип и работа со снапшотом в <see cref="TableContent"/>.
/// </summary>
public class TableHub : CollaborativeYjsHub
{
    public TableHub(
        ApplicationDbContext db,
        ILibraryAccessService libraryAccess,
        ILogger<TableHub> logger)
        : base(db, libraryAccess, logger)
    {
    }

    protected override LibraryItemType ItemType => LibraryItemType.Table;

    protected override string GroupPrefix => "table";

    protected override async Task<byte[]?> LoadSnapshotAsync(int itemId)
    {
        return await Db.TableContents
            .Where(c => c.LibraryItemId == itemId)
            .Select(c => c.YjsState)
            .FirstOrDefaultAsync();
    }

    protected override async Task SaveSnapshotAsync(int itemId, byte[] state)
    {
        var table = await Db.LibraryItems
            .Include(d => d.TableContent)
            .FirstOrDefaultAsync(d => d.Id == itemId && d.Type == LibraryItemType.Table);
        if (table == null)
        {
            throw new HubException("Table not found");
        }

        if (table.TableContent == null)
        {
            table.TableContent = new TableContent { LibraryItemId = table.Id };
            Db.TableContents.Add(table.TableContent);
        }

        table.TableContent.YjsState = state;
        table.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync();
    }
}
