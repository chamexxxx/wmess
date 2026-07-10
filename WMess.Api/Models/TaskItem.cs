using System.ComponentModel.DataAnnotations;
using WMess.Api.Enums;

namespace WMess.Api.Models;

public class TaskItem
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(255)]
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public TaskPriority Priority { get; set; } = TaskPriority.Medium;

    public Guid ColumnId { get; set; }
    public TaskBoardColumn? Column { get; set; }

    public int SortOrder { get; set; }

    public DateTime? StartDate { get; set; }
    public DateTime? DueDate { get; set; }

    public decimal EstimatedHours { get; set; } = 8;

    public ScheduleMode ScheduleMode { get; set; } = ScheduleMode.Auto;

    public string? PrimaryAssigneeId { get; set; }
    public ApplicationUser? PrimaryAssignee { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public int? ProjectId { get; set; }
    public Project? Project { get; set; }

    public int? TeamId { get; set; }
    public Team? Team { get; set; }

    public string CreatedById { get; set; } = string.Empty;
    public ApplicationUser? CreatedBy { get; set; }

    public ICollection<TaskAssignment> Assignments { get; set; } = new List<TaskAssignment>();
    public ICollection<TaskComment> Comments { get; set; } = new List<TaskComment>();
    public ICollection<TaskLabelAssignment> LabelAssignments { get; set; } = new List<TaskLabelAssignment>();
}
