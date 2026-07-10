namespace WMess.Api.Models.DTO.Tasks;

public class TeamScheduleSettingsResponse
{
    public int WorkingDays { get; set; }
    public decimal HoursPerDay { get; set; }
    public string TimeZone { get; set; } = "UTC";
}

public class UpdateTeamScheduleSettingsRequest
{
    public int WorkingDays { get; set; }
    public decimal HoursPerDay { get; set; }
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
    public int? ProjectId { get; set; }
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
