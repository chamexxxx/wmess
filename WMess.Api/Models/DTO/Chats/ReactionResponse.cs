namespace WMess.Api.Models.DTO.Chats;

public class ReactionResponse
{
    public int Id { get; set; }
    public int MessageId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Emoji { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
