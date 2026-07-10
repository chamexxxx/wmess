namespace WMess.Api.Models.DTO.Chats;

public class StartCallRequest
{
  /// <summary>audio или video</summary>
  public string CallType { get; set; } = "video";
}
