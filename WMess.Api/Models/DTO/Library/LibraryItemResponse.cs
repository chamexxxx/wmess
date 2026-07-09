namespace WMess.Api.Models.DTO.Library;

public class LibraryItemResponse
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public int? FolderId { get; set; }
    /// <summary>Тип элемента: "document" | "board" | "table" | "file" | "link".</summary>
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    /// <summary>Адрес внешнего ресурса — заполняется только для элементов типа "link".</summary>
    public string? Url { get; set; }
}
