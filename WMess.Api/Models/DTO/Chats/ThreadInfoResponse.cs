namespace WMess.Api.Models.DTO.Chats;

public class ThreadInfoResponse
{
  public int RootMessageId { get; set; }
  public int ReplyCount { get; set; }
  public MessageResponse? LastReply { get; set; }
}
