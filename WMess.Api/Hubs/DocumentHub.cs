using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using WMess.Api.Data;
using WMess.Api.Models;
using WMess.Api.Services;

namespace WMess.Api.Hubs;

/// <summary>
/// Хаб совместного редактирования документов (<see cref="LibraryItemType.Document"/>).
/// Всё реле Yjs-протокола — в базовом <see cref="CollaborativeYjsHub"/>; здесь только
/// тип и работа со снапшотом в <see cref="DocumentContent"/>.
/// </summary>
public class DocumentHub : CollaborativeYjsHub
{
    public DocumentHub(
        ApplicationDbContext db,
        ILibraryAccessService libraryAccess,
        ILogger<DocumentHub> logger)
        : base(db, libraryAccess, logger)
    {
    }

    protected override LibraryItemType ItemType => LibraryItemType.Document;

    protected override string GroupPrefix => "document";

    protected override async Task<byte[]?> LoadSnapshotAsync(int itemId)
    {
        return await Db.DocumentContents
            .Where(c => c.LibraryItemId == itemId)
            .Select(c => c.YjsState)
            .FirstOrDefaultAsync();
    }

    protected override async Task SaveSnapshotAsync(int itemId, byte[] state)
    {
        var document = await Db.LibraryItems
            .Include(d => d.DocumentContent)
            .FirstOrDefaultAsync(d => d.Id == itemId && d.Type == LibraryItemType.Document);
        if (document == null)
        {
            throw new HubException("Document not found");
        }

        if (document.DocumentContent == null)
        {
            document.DocumentContent = new DocumentContent { LibraryItemId = document.Id };
            Db.DocumentContents.Add(document.DocumentContent);
        }

        document.DocumentContent.YjsState = state;
        document.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync();
    }
}
