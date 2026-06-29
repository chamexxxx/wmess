namespace WMess.Api.Models.DTO.Library;

public class LibraryItemResponse
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public int? FolderId { get; set; }
    /// <summary>Тип элемента: "document" | "board" | "table".</summary>
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
