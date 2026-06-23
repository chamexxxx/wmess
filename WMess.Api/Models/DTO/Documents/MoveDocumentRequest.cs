namespace WMess.Api.Models.DTO.Documents;

/// <summary>Перемещение документа: null — в корень проекта (вне папок).</summary>
public class MoveDocumentRequest
{
    public int? FolderId { get; set; }
}
