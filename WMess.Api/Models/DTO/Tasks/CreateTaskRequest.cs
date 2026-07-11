using System.ComponentModel.DataAnnotations;
using WMess.Api.Enums;

namespace WMess.Api.Models.DTO.Tasks;

public class CreateTaskRequest
{
    [Required]
    [MaxLength(255)]
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }
    public TaskPriority Priority { get; set; } = TaskPriority.Medium;
    public Guid? ColumnId { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? DueDate { get; set; }
    public decimal EstimatedHours { get; set; } = 8;
    public ScheduleMode ScheduleMode { get; set; } = ScheduleMode.Auto;
    public int? ProjectId { get; set; }
    public int? TeamId { get; set; }
    public Guid? GroupId { get; set; }
    public string? PrimaryAssigneeId { get; set; }
    public List<string> AssignedUserIds { get; set; } = new();
    public List<Guid> LabelIds { get; set; } = new();
}
