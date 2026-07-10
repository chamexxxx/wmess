using System.ComponentModel.DataAnnotations;
using WMess.Api.Enums;

namespace WMess.Api.Models.DTO.Tasks;

public class UpdateTaskRequest
{
    [Required]
    [MaxLength(255)]
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }
    public TaskPriority Priority { get; set; }
    public Guid ColumnId { get; set; }
    public int SortOrder { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? DueDate { get; set; }
    public decimal EstimatedHours { get; set; }
    public ScheduleMode ScheduleMode { get; set; }
    public string? PrimaryAssigneeId { get; set; }
    public List<string> AssignedUserIds { get; set; } = new();
    public List<Guid> LabelIds { get; set; } = new();
}
