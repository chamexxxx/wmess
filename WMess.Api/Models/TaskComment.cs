using System.ComponentModel.DataAnnotations;

namespace WMess.Api.Models;

public class TaskComment
{
    public Guid Id { get; set; }

    public Guid TaskId { get; set; }
    public TaskItem? Task { get; set; }

    [Required]
    public string Content { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string UserId { get; set; } = string.Empty;
    public ApplicationUser? User { get; set; }
}
