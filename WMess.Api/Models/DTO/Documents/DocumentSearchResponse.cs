namespace WMess.Api.Models.DTO.Documents;

/// <summary>Результаты поиска по проекту: совпавшие папки и документы.</summary>
public class DocumentSearchResponse
{
    public List<FolderResponse> Folders { get; set; } = new();

    public List<DocumentResponse> Documents { get; set; } = new();
}
