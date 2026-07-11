namespace WMess.Api.Models.DTO.Calendar;

public record CalendarEventResponse(
    Guid Id,
    string Title,
    string? Description,
    string? Location,
    DateTime StartUtc,
    DateTime EndUtc,
    bool AllDay,
    int ProjectId,
    string CreatedById,
    string CreatedByEmail,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record CreateCalendarEventRequest(
    string Title,
    string? Description,
    string? Location,
    DateTime StartUtc,
    DateTime EndUtc,
    bool AllDay,
    int ProjectId);

public record UpdateCalendarEventRequest(
    string Title,
    string? Description,
    string? Location,
    DateTime StartUtc,
    DateTime EndUtc,
    bool AllDay);
