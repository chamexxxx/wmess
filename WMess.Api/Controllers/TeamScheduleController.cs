using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Authorization;
using WMess.Api.Data;
using WMess.Api.Models;
using WMess.Api.Models.DTO.Tasks;
using WMess.Api.Services;

namespace WMess.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/teams/{teamId:int}")]
public class TeamScheduleController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAuthorizationService _authorizationService;
    private readonly IScheduleService _scheduleService;

    public TeamScheduleController(
        ApplicationDbContext context,
        IAuthorizationService authorizationService,
        IScheduleService scheduleService)
    {
        _context = context;
        _authorizationService = authorizationService;
        _scheduleService = scheduleService;
    }

    [HttpGet("schedule-settings")]
    public async Task<ActionResult<TeamScheduleSettingsResponse>> GetSettings(int teamId)
    {
        if (!await IsMemberAsync(teamId)) return Forbid();

        var settings = await _context.TeamScheduleSettings.FindAsync(teamId);
        if (settings == null)
        {
            settings = new TeamScheduleSettings { TeamId = teamId };
            _context.TeamScheduleSettings.Add(settings);
            await _context.SaveChangesAsync();
        }

        return Ok(new TeamScheduleSettingsResponse
        {
            WorkingDays = settings.WorkingDays,
            HoursPerDay = settings.HoursPerDay,
            WorkStartHour = settings.WorkStartHour,
            TimeZone = settings.TimeZone
        });
    }

    [HttpPut("schedule-settings")]
    public async Task<IActionResult> UpdateSettings(int teamId, UpdateTeamScheduleSettingsRequest request)
    {
        if (!await CanManageAsync(teamId)) return Forbid();

        var settings = await _context.TeamScheduleSettings.FindAsync(teamId);
        if (settings == null)
        {
            settings = new TeamScheduleSettings { TeamId = teamId };
            _context.TeamScheduleSettings.Add(settings);
        }

        settings.WorkingDays = request.WorkingDays;
        settings.HoursPerDay = request.HoursPerDay;
        settings.WorkStartHour = Math.Clamp(request.WorkStartHour, 0, 23);
        settings.TimeZone = request.TimeZone;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("holidays")]
    public async Task<ActionResult<IEnumerable<TeamHolidayResponse>>> GetHolidays(int teamId)
    {
        if (!await IsMemberAsync(teamId)) return Forbid();

        var holidays = await _context.TeamHolidays
            .Where(h => h.TeamId == teamId)
            .OrderBy(h => h.Date)
            .Select(h => new TeamHolidayResponse { Id = h.Id, Date = h.Date, Name = h.Name })
            .ToListAsync();

        return Ok(holidays);
    }

    [HttpPost("holidays")]
    public async Task<ActionResult<TeamHolidayResponse>> AddHoliday(int teamId, CreateTeamHolidayRequest request)
    {
        if (!await CanManageAsync(teamId)) return Forbid();

        var holiday = new TeamHoliday
        {
            Id = Guid.NewGuid(),
            TeamId = teamId,
            Date = request.Date,
            Name = request.Name
        };

        _context.TeamHolidays.Add(holiday);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetHolidays), new { teamId }, new TeamHolidayResponse
        {
            Id = holiday.Id,
            Date = holiday.Date,
            Name = holiday.Name
        });
    }

    [HttpDelete("holidays/{holidayId:guid}")]
    public async Task<IActionResult> DeleteHoliday(int teamId, Guid holidayId)
    {
        if (!await CanManageAsync(teamId)) return Forbid();

        var holiday = await _context.TeamHolidays.FirstOrDefaultAsync(h => h.Id == holidayId && h.TeamId == teamId);
        if (holiday == null) return NotFound();

        _context.TeamHolidays.Remove(holiday);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("schedule/recalculate")]
    public async Task<ActionResult<object>> Recalculate(int teamId, RecalculateScheduleRequest request)
    {
        if (!await IsMemberAsync(teamId)) return Forbid();

        var updated = await _scheduleService.RecalculateAsync(
            teamId,
            request.AnchorDate,
            request.AnchorLocalDate,
            request.ProjectId,
            request.GroupId);
        return Ok(new { updated });
    }

    [HttpGet("task-labels")]
    public async Task<ActionResult<IEnumerable<TaskLabelDefinitionResponse>>> GetLabels(int teamId)
    {
        if (!await IsMemberAsync(teamId)) return Forbid();

        var labels = await _context.TaskLabelDefinitions
            .Where(l => l.TeamId == teamId)
            .OrderBy(l => l.Name)
            .Select(l => new TaskLabelDefinitionResponse { Id = l.Id, Name = l.Name, Color = l.Color })
            .ToListAsync();

        return Ok(labels);
    }

    [HttpPost("task-labels")]
    public async Task<ActionResult<TaskLabelDefinitionResponse>> CreateLabel(int teamId, CreateTaskLabelRequest request)
    {
        if (!await CanManageAsync(teamId)) return Forbid();

        var label = new TaskLabelDefinition
        {
            Id = Guid.NewGuid(),
            TeamId = teamId,
            Name = request.Name,
            Color = request.Color
        };

        _context.TaskLabelDefinitions.Add(label);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetLabels), new { teamId }, new TaskLabelDefinitionResponse
        {
            Id = label.Id,
            Name = label.Name,
            Color = label.Color
        });
    }

    [HttpPut("task-labels/{labelId:guid}")]
    public async Task<IActionResult> UpdateLabel(int teamId, Guid labelId, UpdateTaskLabelRequest request)
    {
        if (!await CanManageAsync(teamId)) return Forbid();

        var label = await _context.TaskLabelDefinitions.FirstOrDefaultAsync(l => l.Id == labelId && l.TeamId == teamId);
        if (label == null) return NotFound();

        label.Name = request.Name;
        label.Color = request.Color;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("task-labels/{labelId:guid}")]
    public async Task<IActionResult> DeleteLabel(int teamId, Guid labelId)
    {
        if (!await CanManageAsync(teamId)) return Forbid();

        var label = await _context.TaskLabelDefinitions.FirstOrDefaultAsync(l => l.Id == labelId && l.TeamId == teamId);
        if (label == null) return NotFound();

        _context.TaskLabelDefinitions.Remove(label);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private async Task<bool> IsMemberAsync(int teamId)
    {
        var team = await _context.Teams.FindAsync(teamId);
        if (team == null) return false;
        return (await _authorizationService.AuthorizeAsync(User, team, Policies.TeamMember)).Succeeded;
    }

    private async Task<bool> CanManageAsync(int teamId)
    {
        var team = await _context.Teams.FindAsync(teamId);
        if (team == null) return false;
        return (await _authorizationService.AuthorizeAsync(User, team, Policies.TeamManage)).Succeeded;
    }
}
