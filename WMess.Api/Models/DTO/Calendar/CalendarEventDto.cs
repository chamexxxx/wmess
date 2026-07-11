namespace WMess.Api.Models.DTO.Calendar;

public record CalendarEventAttendeeResponse(string UserId, string Email);

public record CalendarEventResponse(
    Guid Id,
    string Title,
    string? Description,
    string? Location,
    string Color,
    bool IsWholeTeam,
    DateTime StartUtc,
    DateTime EndUtc,
    bool AllDay,
    int ProjectId,
    string CreatedById,
    string CreatedByEmail,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<CalendarEventAttendeeResponse> Attendees);

public record CreateCalendarEventRequest(
    string Title,
    string? Description,
    string? Location,
    string? Color,
    bool IsWholeTeam,
    IReadOnlyList<string>? AttendeeUserIds,
    DateTime StartUtc,
    DateTime EndUtc,
    bool AllDay,
    int ProjectId);

public record UpdateCalendarEventRequest(
    string Title,
    string? Description,
    string? Location,
    string? Color,
    bool IsWholeTeam,
    IReadOnlyList<string>? AttendeeUserIds,
    DateTime StartUtc,
    DateTime EndUtc,
    bool AllDay);
