namespace WMess.Api.Models.DTO.Library;

/// <summary>Непосредственное содержимое папки (или корня проекта) для файлового менеджера.</summary>
public class FolderContentsResponse
{
    /// <summary>Текущая папка; null — корень проекта.</summary>
    public int? FolderId { get; set; }

    public string? FolderName { get; set; }

    /// <summary>Путь от корня к текущей папке (для хлебных крошек).</summary>
    public List<BreadcrumbItem> Path { get; set; } = new();

    public List<FolderResponse> Folders { get; set; } = new();

    public List<LibraryItemResponse> Items { get; set; } = new();
}
