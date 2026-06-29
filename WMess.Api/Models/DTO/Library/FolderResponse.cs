namespace WMess.Api.Models.DTO.Library;

public class FolderResponse
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public int? ParentFolderId { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
