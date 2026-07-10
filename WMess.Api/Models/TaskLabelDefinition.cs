using System.ComponentModel.DataAnnotations;

namespace WMess.Api.Models;

public class TaskLabelDefinition
{
    public Guid Id { get; set; }

    public int TeamId { get; set; }
    public Team? Team { get; set; }

    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Color { get; set; } = "#808080";

    public ICollection<TaskLabelAssignment> Assignments { get; set; } = new List<TaskLabelAssignment>();
}
