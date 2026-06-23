namespace WMess.Api.Models.DTO.Documents;

/// <summary>Перемещение папки: null — в корень проекта.</summary>
public class MoveFolderRequest
{
    public int? ParentFolderId { get; set; }
}
