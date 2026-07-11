namespace WMess.Api.Models.DTO.Tasks;

public class TeamScheduleSettingsResponse
{
    public int WorkingDays { get; set; }
    public decimal HoursPerDay { get; set; }
    public int WorkStartHour { get; set; }
    public string TimeZone { get; set; } = "UTC";
}

public class UpdateTeamScheduleSettingsRequest
{
    public int WorkingDays { get; set; }
    public decimal HoursPerDay { get; set; }
    public int WorkStartHour { get; set; }
    public string TimeZone { get; set; } = "UTC";
}

public class TeamHolidayResponse
{
    public Guid Id { get; set; }
    public DateOnly Date { get; set; }
    public string? Name { get; set; }
}

public class CreateTeamHolidayRequest
{
    public DateOnly Date { get; set; }
    public string? Name { get; set; }
}

public class RecalculateScheduleRequest
{
    public DateTime? AnchorDate { get; set; }
    /// <summary>Calendar date (yyyy-MM-dd) for the first work day — avoids UTC/local drift.</summary>
    public DateOnly? AnchorLocalDate { get; set; }
    public int? ProjectId { get; set; }
    public Guid? GroupId { get; set; }
}

public class TaskLabelDefinitionResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
}

public class CreateTaskLabelRequest
{
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = "#808080";
}

public class UpdateTaskLabelRequest
{
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = "#808080";
}

public class TaskGroupResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public string Color { get; set; } = "#6B7280";
}

public class CreateTaskGroupRequest
{
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = "#6B7280";
}

public class UpdateTaskGroupRequest
{
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = "#6B7280";
}

public class ReorderTaskGroupsRequest
{
    public List<ReorderTaskGroupItem> Items { get; set; } = new();
}

public class ReorderTaskGroupItem
{
    public Guid Id { get; set; }
    public int SortOrder { get; set; }
}
