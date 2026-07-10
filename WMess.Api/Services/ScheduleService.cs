using Microsoft.EntityFrameworkCore;
using WMess.Api.Data;
using WMess.Api.Enums;
using WMess.Api.Models;

namespace WMess.Api.Services;

public interface IScheduleService
{
    Task<int> RecalculateAsync(int teamId, DateTime? anchorDate, int? projectId, CancellationToken ct = default);
}

public class ScheduleService : IScheduleService
{
    private readonly ApplicationDbContext _context;

    public ScheduleService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<int> RecalculateAsync(int teamId, DateTime? anchorDate, int? projectId, CancellationToken ct = default)
    {
        var settings = await _context.TeamScheduleSettings
            .FirstOrDefaultAsync(s => s.TeamId == teamId, ct)
            ?? new TeamScheduleSettings { TeamId = teamId };

        var holidays = await _context.TeamHolidays
            .Where(h => h.TeamId == teamId)
            .Select(h => h.Date)
            .ToListAsync(ct);

        var holidaySet = holidays.ToHashSet();

        var doneColumnIds = await _context.TaskBoardColumns
            .Where(c => c.TeamId == teamId && c.IsDoneColumn)
            .Select(c => c.Id)
            .ToListAsync(ct);

        var query = _context.Tasks
            .Where(t => t.TeamId == teamId && t.ScheduleMode == ScheduleMode.Auto);

        if (projectId.HasValue)
            query = query.Where(t => t.ProjectId == projectId);

        if (doneColumnIds.Count > 0)
            query = query.Where(t => !doneColumnIds.Contains(t.ColumnId));

        var tasks = await query
            .OrderBy(t => t.PrimaryAssigneeId)
            .ThenByDescending(t => t.Priority)
            .ThenBy(t => t.SortOrder)
            .ToListAsync(ct);

        var cursorByAssignee = new Dictionary<string?, DateTime>();
        var anchor = DateOnly.FromDateTime((anchorDate ?? DateTime.UtcNow).Date);

        foreach (var task in tasks)
        {
            var key = task.PrimaryAssigneeId;
            if (!cursorByAssignee.TryGetValue(key, out var cursor))
                cursor = anchor.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

            cursor = SkipToWorkingDay(cursor, settings.WorkingDays, holidaySet);
            task.StartDate = cursor;

            var hours = task.EstimatedHours > 0 ? task.EstimatedHours : settings.HoursPerDay;
            var end = AddWorkingHours(cursor, hours, settings, holidaySet);
            task.DueDate = end;
            task.UpdatedAt = DateTime.UtcNow;

            cursorByAssignee[key] = NextWorkingDayStart(end, settings.WorkingDays, holidaySet);
        }

        return await _context.SaveChangesAsync(ct);
    }

    private static DateTime SkipToWorkingDay(DateTime dt, int workingDays, HashSet<DateOnly> holidays)
    {
        while (!IsWorkingDay(dt, workingDays, holidays))
            dt = dt.AddDays(1);
        return dt;
    }

    private static DateTime NextWorkingDayStart(DateTime after, int workingDays, HashSet<DateOnly> holidays)
    {
        var next = after.Date.AddDays(1);
        return SkipToWorkingDay(next, workingDays, holidays);
    }

    private static bool IsWorkingDay(DateTime dt, int workingDays, HashSet<DateOnly> holidays)
    {
        var date = DateOnly.FromDateTime(dt);
        if (holidays.Contains(date)) return false;
        var dow = (int)dt.DayOfWeek; // 0=Sun
        return (workingDays & (1 << dow)) != 0;
    }

    private static DateTime AddWorkingHours(DateTime start, decimal hours, TeamScheduleSettings settings, HashSet<DateOnly> holidays)
    {
        var remaining = hours;
        var current = start;

        while (remaining > 0)
        {
            if (!IsWorkingDay(current, settings.WorkingDays, holidays))
            {
                current = current.Date.AddDays(1);
                continue;
            }

            var dayCapacity = settings.HoursPerDay;
            var use = Math.Min(remaining, dayCapacity);
            remaining -= use;
            current = current.AddHours((double)use);

            if (remaining > 0)
                current = current.Date.AddDays(1);
        }

        return current;
    }
}
