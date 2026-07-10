namespace WMess.Api.Models.DTO.Chats;

public class AttachmentResponse
{
    public int Id { get; set; }
    public int MessageId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; }
}
