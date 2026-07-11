namespace WMess.Web.Models.DTO;

public class BffUserResponse
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Login { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public bool HasAvatar { get; set; }
}
