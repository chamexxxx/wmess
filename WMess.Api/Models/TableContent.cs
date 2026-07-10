using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMess.Api.Models;

/// <summary>
/// Контент элемента библиотеки типа <see cref="LibraryItemType.Table"/>:
/// Yjs-снапшот совместного редактирования. Связь 1:1 с <see cref="LibraryItem"/> (PK = FK).
/// </summary>
public class TableContent
{
    [Key]
    public int LibraryItemId { get; set; }

    // Yjs state хранится как binary blob
    public byte[]? YjsState { get; set; }

    [ForeignKey(nameof(LibraryItemId))]
    public LibraryItem Item { get; set; } = null!;
}
