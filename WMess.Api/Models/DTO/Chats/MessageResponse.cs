namespace WMess.Api.Models.DTO.Chats;

public class MessageResponse
{
    public int Id { get; set; }
    public int ChatId { get; set; }
    public string AuthorId { get; set; } = string.Empty;
    public string? AuthorEmail { get; set; }
    public string? Content { get; set; }
    public int? ParentMessageId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? EditedAt { get; set; }
    public string? Transcription { get; set; }
    public string? WaveformData { get; set; }
    public string? CallRoomId { get; set; }
    public string? CallType { get; set; }
    public List<AttachmentResponse> Attachments { get; set; } = new();
    public List<ReactionResponse> Reactions { get; set; } = new();
    public List<InlineEntityResponse> InlineEntities { get; set; } = new();
}
