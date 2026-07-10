using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using WMess.Api.Data;
using WMess.Api.Models;
using WMess.Api.Services;

namespace WMess.Api.Hubs;

/// <summary>
/// Хаб совместного редактирования досок (<see cref="LibraryItemType.Board"/>).
/// Всё реле Yjs-протокола — в базовом <see cref="CollaborativeYjsHub"/>; здесь только
/// тип и работа со снапшотом в <see cref="BoardContent"/>.
/// </summary>
public class BoardHub : CollaborativeYjsHub
{
    public BoardHub(
        ApplicationDbContext db,
        ILibraryAccessService libraryAccess,
        ILogger<BoardHub> logger)
        : base(db, libraryAccess, logger)
    {
    }

    protected override LibraryItemType ItemType => LibraryItemType.Board;

    protected override string GroupPrefix => "board";

    protected override async Task<byte[]?> LoadSnapshotAsync(int itemId)
    {
        return await Db.BoardContents
            .Where(c => c.LibraryItemId == itemId)
            .Select(c => c.YjsState)
            .FirstOrDefaultAsync();
    }

    protected override async Task SaveSnapshotAsync(int itemId, byte[] state)
    {
        var board = await Db.LibraryItems
            .Include(d => d.BoardContent)
            .FirstOrDefaultAsync(d => d.Id == itemId && d.Type == LibraryItemType.Board);
        if (board == null)
        {
            throw new HubException("Board not found");
        }

        if (board.BoardContent == null)
        {
            board.BoardContent = new BoardContent { LibraryItemId = board.Id };
            Db.BoardContents.Add(board.BoardContent);
        }

        board.BoardContent.YjsState = state;
        board.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync();
    }
}
