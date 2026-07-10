using WMess.Api.Enums;

namespace WMess.Api.Models.DTO.Tasks;

public class PatchTaskRequest
{
    public string? Title { get; set; }
    public Guid? ColumnId { get; set; }
    public int? SortOrder { get; set; }
    public TaskPriority? Priority { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? DueDate { get; set; }
    public decimal? EstimatedHours { get; set; }
    public ScheduleMode? ScheduleMode { get; set; }
    public string? PrimaryAssigneeId { get; set; }
}
