namespace WMess.Api.Models.DTO.Library;

public class CreateLinkRequest
{
    public int ProjectId { get; set; }
    public int? FolderId { get; set; }
    public string Title { get; set; } = "Ссылка";
    public string Url { get; set; } = string.Empty;
}
