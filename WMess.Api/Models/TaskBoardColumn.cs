using System.ComponentModel.DataAnnotations;

namespace WMess.Api.Models;

public class TaskBoardColumn
{
    public Guid Id { get; set; }

    public int TeamId { get; set; }
    public Team? Team { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    [MaxLength(20)]
    public string Color { get; set; } = "#808080";

    public bool IsDoneColumn { get; set; }

    public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
}
