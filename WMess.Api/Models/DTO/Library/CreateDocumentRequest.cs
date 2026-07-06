namespace WMess.Api.Models.DTO.Library;

public class CreateDocumentRequest
{
    public int ProjectId { get; set; }
    public int? FolderId { get; set; }
    public string Title { get; set; } = "Untitled Document";
}
