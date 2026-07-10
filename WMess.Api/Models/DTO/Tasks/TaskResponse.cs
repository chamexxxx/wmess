using WMess.Api.Enums;

namespace WMess.Api.Models.DTO.Tasks;

public class TaskResponse
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public TaskPriority Priority { get; set; }
    public Guid ColumnId { get; set; }
    public string ColumnName { get; set; } = string.Empty;
    public string ColumnColor { get; set; } = string.Empty;
    public bool IsDoneColumn { get; set; }
    public int SortOrder { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? DueDate { get; set; }
    public decimal EstimatedHours { get; set; }
    public ScheduleMode ScheduleMode { get; set; }
    public string? PrimaryAssigneeId { get; set; }
    public string? PrimaryAssigneeEmail { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public int? ProjectId { get; set; }
    public int? TeamId { get; set; }
    public Guid GroupId { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public string GroupColor { get; set; } = "#6B7280";
    public string CreatedById { get; set; } = string.Empty;
    public string CreatedByEmail { get; set; } = string.Empty;
    public List<string> AssignedUserIds { get; set; } = new();
    public List<TaskAssigneeResponse> Assignees { get; set; } = new();
    public List<TaskLabelResponse> Labels { get; set; } = new();
}

public class TaskAssigneeResponse
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}

public class TaskLabelResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
}

public class TaskCommentResponse
{
    public Guid Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserEmail { get; set; } = string.Empty;
}
