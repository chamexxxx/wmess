using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMess.Api.Models;

public class ChatMember
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ChatId { get; set; }

    [Required]
    public string UserId { get; set; } = string.Empty;

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    public DateTime? LastReadAt { get; set; }

    [ForeignKey(nameof(ChatId))]
    public Chat Chat { get; set; } = null!;

    [ForeignKey(nameof(UserId))]
    public ApplicationUser User { get; set; } = null!;
}
