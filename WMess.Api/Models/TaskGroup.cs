using System.ComponentModel.DataAnnotations;

namespace WMess.Api.Models;

public class TaskGroup
{
    public Guid Id { get; set; }

    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    [MaxLength(20)]
    public string Color { get; set; } = "#6B7280";

    public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
}
