namespace WMess.Api.Models.DTO.Library;

/// <summary>Результаты поиска по проекту: совпавшие папки и элементы библиотеки.</summary>
public class LibrarySearchResponse
{
    public List<FolderResponse> Folders { get; set; } = new();

    public List<LibraryItemResponse> Items { get; set; } = new();
}
