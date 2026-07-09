namespace WMess.Api.Models.DTO.Chats;

public class CreateChatRequest
{
    public string? Name { get; set; }
    public int? TeamId { get; set; }
    public int? ProjectId { get; set; }
    public int MaxNestingLevel { get; set; } = 0;
}
