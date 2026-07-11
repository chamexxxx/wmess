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

    /// <summary>Краткое превью последнего сообщения чата (для списка чатов). null — сообщений нет.</summary>
    public string? LastMessagePreview { get; set; }

    /// <summary>Имя автора последнего сообщения (для списка чатов). null — сообщений нет.</summary>
    public string? LastMessageAuthor { get; set; }

    /// <summary>Время последнего сообщения чата. null — сообщений нет.</summary>
    public DateTime? LastMessageAt { get; set; }
}

