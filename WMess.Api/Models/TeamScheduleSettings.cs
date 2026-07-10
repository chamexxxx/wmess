using System.ComponentModel.DataAnnotations;

namespace WMess.Api.Models;

public class TeamScheduleSettings
{
    public int TeamId { get; set; }
    public Team? Team { get; set; }

    /// <summary>Bitmask: bit 0 = Sunday, bit 1 = Monday, ... bit 6 = Saturday.</summary>
    public int WorkingDays { get; set; } = 0b0111110; // Mon-Fri

    public decimal HoursPerDay { get; set; } = 8;

    /// <summary>Local hour (0–23) when the work period starts each working day.</summary>
    public int WorkStartHour { get; set; } = 9;

    [MaxLength(64)]
    public string TimeZone { get; set; } = "UTC";
}
