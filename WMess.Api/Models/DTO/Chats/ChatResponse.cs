using WMess.Api.Enums;

namespace WMess.Api.Models.DTO.Chats;

public class ChatResponse
{
    public int Id { get; set; }
    public string? Name { get; set; }
    public ChatType Type { get; set; }
    public int? TeamId { get; set; }
    public int? ProjectId { get; set; }
    public int MaxNestingLevel { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool CanManage { get; set; }
}

