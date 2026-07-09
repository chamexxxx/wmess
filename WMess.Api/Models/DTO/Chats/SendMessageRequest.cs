using WMess.Api.Enums;

namespace WMess.Api.Models.DTO.Chats;

public class SendMessageRequest
{
    public string? Content { get; set; }
    public int? ParentMessageId { get; set; }
    public ReplyMode? ReplyMode { get; set; }
}
