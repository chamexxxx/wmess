using System.ComponentModel.DataAnnotations;

namespace WMess.Api.Models;

public class CalendarEvent
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(255)]
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    /// <summary>Meeting link, room, or location.</summary>
    [MaxLength(500)]
    public string? Location { get; set; }

    [MaxLength(7)]
    public string Color { get; set; } = "#4FA47A";

    public bool IsWholeTeam { get; set; }

    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public bool AllDay { get; set; }

    public int ProjectId { get; set; }
    public Project? Project { get; set; }

    public string CreatedById { get; set; } = string.Empty;
    public ApplicationUser? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<CalendarEventAttendee> Attendees { get; set; } = new List<CalendarEventAttendee>();
}
