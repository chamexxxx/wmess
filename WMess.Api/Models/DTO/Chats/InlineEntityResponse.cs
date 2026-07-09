namespace WMess.Api.Models.DTO.Chats;

public class InlineEntityResponse
{
  public string Type { get; set; } = string.Empty;
  public int Id { get; set; }
  public string Title { get; set; } = string.Empty;
  public string? Preview { get; set; }
}
