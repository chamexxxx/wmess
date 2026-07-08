using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMess.Api.Models;

/// <summary>
/// Контент элемента библиотеки типа <see cref="LibraryItemType.File"/>: загруженный
/// пользователем файл (байты + метаданные). Связь 1:1 с <see cref="LibraryItem"/> (PK = FK).
/// </summary>
public class FileContent
{
    [Key]
    public int LibraryItemId { get; set; }

    // Содержимое файла (binary blob).
    public byte[] Data { get; set; } = System.Array.Empty<byte>();

    // Исходное имя файла с расширением (для скачивания и отображения).
    [MaxLength(300)]
    public string FileName { get; set; } = string.Empty;

    // MIME-тип, определённый при загрузке (для корректной отдачи при скачивании).
    [MaxLength(200)]
    public string ContentType { get; set; } = "application/octet-stream";

    // Размер файла в байтах.
    public long Size { get; set; }

    [ForeignKey(nameof(LibraryItemId))]
    public LibraryItem Item { get; set; } = null!;
}
