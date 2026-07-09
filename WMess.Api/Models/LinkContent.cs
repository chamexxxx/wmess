using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMess.Api.Models;

/// <summary>
/// Контент элемента библиотеки типа <see cref="LibraryItemType.Link"/>: ссылка на внешний
/// ресурс (например, файл в облаке). Отображаемое имя хранится в <see cref="LibraryItem.Title"/>,
/// здесь — сам URL. Связь 1:1 с <see cref="LibraryItem"/> (PK = FK).
/// </summary>
public class LinkContent
{
    [Key]
    public int LibraryItemId { get; set; }

    // Адрес внешнего ресурса.
    [MaxLength(2000)]
    public string Url { get; set; } = string.Empty;

    [ForeignKey(nameof(LibraryItemId))]
    public LibraryItem Item { get; set; } = null!;
}
