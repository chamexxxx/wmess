using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Authorization;
using WMess.Api.Data;
using WMess.Api.Models;
using WMess.Api.Models.DTO.Calendar;
using WMess.Api.Services;

namespace WMess.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/calendar-events")]
public class CalendarEventsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAuthorizationService _authorizationService;
    private readonly ICalendarChangeNotifier _calendarNotifier;

    public CalendarEventsController(
        ApplicationDbContext context,
        IAuthorizationService authorizationService,
        ICalendarChangeNotifier calendarNotifier)
    {
        _context = context;
        _authorizationService = authorizationService;
        _calendarNotifier = calendarNotifier;
    }

    private string GetCurrentUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException("User ID not found in token");

    [HttpGet]
    public async Task<ActionResult<IEnumerable<CalendarEventResponse>>> GetEvents(
        int projectId,
        DateTime? from,
        DateTime? to)
    {
        var project = await _context.Projects.FindAsync(projectId);
        if (project == null) return NotFound();

        var auth = await _authorizationService.AuthorizeAsync(User, project, Policies.ProjectAccess);
        if (!auth.Succeeded) return Forbid();

        var query = _context.CalendarEvents
            .Include(e => e.CreatedBy)
            .Where(e => e.ProjectId == projectId);

        if (from.HasValue)
        {
            query = query.Where(e => e.EndUtc >= from.Value);
        }

        if (to.HasValue)
        {
            query = query.Where(e => e.StartUtc <= to.Value);
        }

        var events = await query
            .OrderBy(e => e.StartUtc)
            .ToListAsync();

        return Ok(events.Select(MapToResponse));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CalendarEventResponse>> GetEvent(Guid id)
    {
        var ev = await LoadEventAsync(id);
        if (ev == null) return NotFound();
        if (!await HasProjectAccessAsync(ev.ProjectId)) return Forbid();
        return Ok(MapToResponse(ev));
    }

    [HttpPost]
    public async Task<ActionResult<CalendarEventResponse>> CreateEvent(CreateCalendarEventRequest request)
    {
        var project = await _context.Projects.FindAsync(request.ProjectId);
        if (project == null) return NotFound();

        var auth = await _authorizationService.AuthorizeAsync(User, project, Policies.ProjectAccess);
        if (!auth.Succeeded) return Forbid();

        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(new { message = "Title is required" });

        if (request.EndUtc <= request.StartUtc)
            return BadRequest(new { message = "End time must be after start time" });

        var ev = new CalendarEvent
        {
            Id = Guid.NewGuid(),
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            Location = request.Location?.Trim(),
            StartUtc = request.StartUtc,
            EndUtc = request.EndUtc,
            AllDay = request.AllDay,
            ProjectId = request.ProjectId,
            CreatedById = GetCurrentUserId(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        _context.CalendarEvents.Add(ev);
        await _context.SaveChangesAsync();

        ev = (await LoadEventAsync(ev.Id))!;
        await _calendarNotifier.NotifyChangedAsync(request.ProjectId);

        return CreatedAtAction(nameof(GetEvent), new { id = ev.Id }, MapToResponse(ev));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CalendarEventResponse>> UpdateEvent(Guid id, UpdateCalendarEventRequest request)
    {
        var ev = await _context.CalendarEvents.FindAsync(id);
        if (ev == null) return NotFound();
        if (!await HasProjectAccessAsync(ev.ProjectId)) return Forbid();

        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(new { message = "Title is required" });

        if (request.EndUtc <= request.StartUtc)
            return BadRequest(new { message = "End time must be after start time" });

        ev.Title = request.Title.Trim();
        ev.Description = request.Description?.Trim();
        ev.Location = request.Location?.Trim();
        ev.StartUtc = request.StartUtc;
        ev.EndUtc = request.EndUtc;
        ev.AllDay = request.AllDay;
        ev.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        ev = (await LoadEventAsync(id))!;
        await _calendarNotifier.NotifyChangedAsync(ev.ProjectId);

        return Ok(MapToResponse(ev));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteEvent(Guid id)
    {
        var ev = await _context.CalendarEvents.FindAsync(id);
        if (ev == null) return NotFound();
        if (!await HasProjectAccessAsync(ev.ProjectId)) return Forbid();

        var projectId = ev.ProjectId;
        _context.CalendarEvents.Remove(ev);
        await _context.SaveChangesAsync();

        await _calendarNotifier.NotifyChangedAsync(projectId);
        return NoContent();
    }

    private async Task<CalendarEvent?> LoadEventAsync(Guid id) =>
        await _context.CalendarEvents
            .Include(e => e.CreatedBy)
            .FirstOrDefaultAsync(e => e.Id == id);

    private async Task<bool> HasProjectAccessAsync(int projectId)
    {
        var project = await _context.Projects.FindAsync(projectId);
        if (project == null) return false;
        var auth = await _authorizationService.AuthorizeAsync(User, project, Policies.ProjectAccess);
        return auth.Succeeded;
    }

    private static CalendarEventResponse MapToResponse(CalendarEvent ev) =>
        new(
            ev.Id,
            ev.Title,
            ev.Description,
            ev.Location,
            ev.StartUtc,
            ev.EndUtc,
            ev.AllDay,
            ev.ProjectId,
            ev.CreatedById,
            ev.CreatedBy?.Email ?? string.Empty,
            ev.CreatedAt,
            ev.UpdatedAt);
}
