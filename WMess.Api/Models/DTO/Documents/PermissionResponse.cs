namespace WMess.Api.Models.DTO.Documents;

public class PermissionResponse
{
    public int Id { get; set; }
    public int DocumentId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserEmail { get; set; } = string.Empty;
    public bool CanView { get; set; }
    public bool CanEdit { get; set; }
    public bool CanManage { get; set; }
    public DateTime GrantedAt { get; set; }
}
