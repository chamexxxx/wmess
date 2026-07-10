namespace WMess.Api.Models.DTO.Chats;

public class PinnedMessageResponse
{
    public int Id { get; set; }
    public int ChatId { get; set; }
    public int MessageId { get; set; }
    public string PinnedBy { get; set; } = string.Empty;
    public DateTime PinnedAt { get; set; }
    public MessageResponse? Message { get; set; }
}
