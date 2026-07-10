using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMess.Api.Models;

public class PinnedMessage
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ChatId { get; set; }

    [Required]
    public int MessageId { get; set; }

    [Required]
    public string PinnedBy { get; set; } = string.Empty;

    public DateTime PinnedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(ChatId))]
    public Chat Chat { get; set; } = null!;

    [ForeignKey(nameof(MessageId))]
    public Message Message { get; set; } = null!;

    [ForeignKey(nameof(PinnedBy))]
    public ApplicationUser PinnedByUser { get; set; } = null!;
}
