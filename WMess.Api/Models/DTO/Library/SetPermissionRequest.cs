namespace WMess.Api.Models.DTO.Library;

public class SetPermissionRequest
{
    public string UserId { get; set; } = string.Empty;
    public bool CanView { get; set; } = true;
    public bool CanEdit { get; set; }
    public bool CanManage { get; set; }
}
