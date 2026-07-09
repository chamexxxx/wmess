using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using WMess.Api.Enums;

namespace WMess.Api.Models;

public class Chat
{
    [Key]
    public int Id { get; set; }

    [MaxLength(200)]
    public string? Name { get; set; }

    [Required]
    public ChatType Type { get; set; }

    public int? TeamId { get; set; }

    public int? ProjectId { get; set; }

    /// <summary>
    /// Максимальная глубина вложенности ответов. 0 = без лимита.
    /// </summary>
    public int MaxNestingLevel { get; set; } = 0;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Навигационные свойства
    [ForeignKey(nameof(TeamId))]
    public Team? Team { get; set; }

    [ForeignKey(nameof(ProjectId))]
    public Project? Project { get; set; }

    public ICollection<Message> Messages { get; set; } = new List<Message>();
    public ICollection<ChatMember> Members { get; set; } = new List<ChatMember>();
    public ICollection<PinnedMessage> PinnedMessages { get; set; } = new List<PinnedMessage>();
}
