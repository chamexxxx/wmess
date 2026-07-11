namespace WMess.Api.Models;

public class CalendarEventAttendee
{
    public Guid EventId { get; set; }
    public CalendarEvent? Event { get; set; }

    public string UserId { get; set; } = string.Empty;
    public ApplicationUser? User { get; set; }
}
