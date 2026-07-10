namespace WMess.Api.Models.DTO.Library;

public class CreateFolderRequest
{
    public int ProjectId { get; set; }
    public int? ParentFolderId { get; set; }
    public string Name { get; set; } = string.Empty;
}
