namespace WMess.Api.Models.DTO.Documents;

public class DocumentResponse
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public int? FolderId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
