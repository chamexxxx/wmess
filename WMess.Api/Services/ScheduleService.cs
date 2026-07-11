using Microsoft.EntityFrameworkCore;
using WMess.Api.Data;
using WMess.Api.Models;

namespace WMess.Api.Services;

public interface IScheduleService
{
    Task<int> RecalculateAsync(
        int teamId,
        DateTime? anchorDate,
        DateOnly? anchorLocalDate,
        int? projectId,
        Guid? groupId,
        CancellationToken ct = default);
}

public class ScheduleService : IScheduleService
{
    private readonly ApplicationDbContext _context;

    public ScheduleService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<int> RecalculateAsync(
        int teamId,
        DateTime? anchorDate,
        DateOnly? anchorLocalDate,
        int? projectId,
        Guid? groupId,
        CancellationToken ct = default)
    {
        var settings = await _context.TeamScheduleSettings
            .FirstOrDefaultAsync(s => s.TeamId == teamId, ct)
            ?? new TeamScheduleSettings { TeamId = teamId };

        var tz = ResolveTimeZone(settings.TimeZone);

        var holidays = await _context.TeamHolidays
            .Where(h => h.TeamId == teamId)
            .Select(h => h.Date)
            .ToListAsync(ct);

        var holidaySet = holidays.ToHashSet();

        var doneColumnIds = await _context.TaskBoardColumns
            .Where(c => c.TeamId == teamId && c.IsDoneColumn)
            .Select(c => c.Id)
            .ToListAsync(ct);

        var scopeQuery = _context.Tasks
            .Include(t => t.Assignments)
            .Where(t => t.TeamId == teamId);

        if (projectId.HasValue)
            scopeQuery = scopeQuery.Where(t => t.ProjectId == projectId);

        if (groupId.HasValue)
            scopeQuery = scopeQuery.Where(t => t.GroupId == groupId);

        if (doneColumnIds.Count > 0)
            scopeQuery = scopeQuery.Where(t => !doneColumnIds.Contains(t.ColumnId));

        var scopedTasks = await scopeQuery.ToListAsync(ct);

        foreach (var task in scopedTasks)
        {
            if (task.StartDate != null && GetLaneKey(task) == null)
            {
                task.StartDate = null;
                task.DueDate = null;
                task.UpdatedAt = DateTime.UtcNow;
            }
        }

        var nowUtc = DateTime.UtcNow;
        var initialCursor = BuildInitialCursor(anchorLocalDate, anchorDate, nowUtc, settings, holidaySet, tz);

        var laneCursors = new Dictionary<string, DateTime>();

        foreach (var existing in scopedTasks.Where(t => t.StartDate != null && GetLaneKey(t) != null))
        {
            var key = GetLaneKey(existing)!;
            var end = existing.DueDate ?? existing.StartDate!.Value;
            if (!laneCursors.TryGetValue(key, out var cur) || end > cur)
                laneCursors[key] = end;
        }

        var poolTasks = scopedTasks
            .Where(t => t.StartDate == null)
            .OrderByDescending(t => t.Priority)
            .ThenBy(t => t.SortOrder)
            .ToList();

        foreach (var task in poolTasks)
        {
            var laneKey = GetLaneKey(task);
            if (laneKey == null)
                continue;

            if (!laneCursors.TryGetValue(laneKey, out var cursor))
                cursor = initialCursor;

            cursor = SnapToNextWorkSlot(cursor, settings, holidaySet, tz);
            task.StartDate = cursor;
            var hours = task.EstimatedHours > 0 ? task.EstimatedHours : settings.HoursPerDay;
            task.DueDate = AddWorkingHours(cursor, hours, settings, holidaySet, tz);
            task.UpdatedAt = DateTime.UtcNow;
            laneCursors[laneKey] = task.DueDate.Value;
        }

        return await _context.SaveChangesAsync(ct);
    }

    private static DateTime BuildInitialCursor(
        DateOnly? anchorLocalDate,
        DateTime? anchorDate,
        DateTime nowUtc,
        TeamScheduleSettings settings,
        HashSet<DateOnly> holidaySet,
        TimeZoneInfo tz)
    {
        if (anchorLocalDate.HasValue)
        {
            var today = LocalDateOnly(nowUtc, tz);
            if (anchorLocalDate.Value <= today)
                return ResolveDistributionStart(nowUtc, settings, holidaySet, tz);

            var local = WorkPeriodStartLocal(anchorLocalDate.Value, settings);
            return AlignToWorkingMoment(ToUtc(local, tz), settings, holidaySet, tz);
        }

        var cursor = anchorDate ?? nowUtc;
        if (cursor.Kind == DateTimeKind.Unspecified)
            cursor = DateTime.SpecifyKind(cursor, DateTimeKind.Utc);
        else
            cursor = cursor.ToUniversalTime();

        return ResolveDistributionStart(cursor, settings, holidaySet, tz);
    }

    /// <summary>
    /// In work hours → next full hour; otherwise → first hour of the next work period.
    /// </summary>
    private static DateTime ResolveDistributionStart(
        DateTime nowUtc,
        TeamScheduleSettings settings,
        HashSet<DateOnly> holidays,
        TimeZoneInfo tz)
    {
        var local = ToLocal(nowUtc, tz);
        var date = DateOnly.FromDateTime(local);
        var workStart = settings.WorkStartHour;
        var workEnd = workStart + (double)settings.HoursPerDay;
        var hourOfDay = local.TimeOfDay.TotalHours;

        if (IsWorkingDay(nowUtc, settings.WorkingDays, holidays, tz))
        {
            if (hourOfDay < workStart)
                return ToUtc(WorkPeriodStartLocal(date, settings), tz);

            if (hourOfDay < workEnd)
            {
                var nextHour = (int)Math.Floor(hourOfDay) + 1;
                if (nextHour < workEnd)
                {
                    var slot = new DateTime(date.Year, date.Month, date.Day, nextHour, 0, 0, DateTimeKind.Unspecified);
                    return ToUtc(slot, tz);
                }
            }
        }

        var nextPeriod = AlignToWorkingMoment(NextWorkPeriodStartUtc(nowUtc, settings, tz), settings, holidays, tz);
        return WorkPeriodStartUtc(nextPeriod, settings, tz);
    }

    private static string? GetLaneKey(TaskItem task)
    {
        if (!string.IsNullOrEmpty(task.PrimaryAssigneeId))
            return task.PrimaryAssigneeId;

        return task.Assignments.FirstOrDefault()?.UserId;
    }

    private static TimeZoneInfo ResolveTimeZone(string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) return TimeZoneInfo.Utc;
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(id);
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.Utc;
        }
        catch (InvalidTimeZoneException)
        {
            return TimeZoneInfo.Utc;
        }
    }

    private static DateTime ToLocal(DateTime utc, TimeZoneInfo tz) =>
        TimeZoneInfo.ConvertTimeFromUtc(utc, tz);

    private static DateTime ToUtc(DateTime local, TimeZoneInfo tz) =>
        TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), tz);

    private static DateOnly LocalDateOnly(DateTime utc, TimeZoneInfo tz) =>
        DateOnly.FromDateTime(ToLocal(utc, tz));

    private static DateTime WorkPeriodStartLocal(DateOnly date, TeamScheduleSettings settings) =>
        new DateTime(date.Year, date.Month, date.Day, settings.WorkStartHour, 0, 0, DateTimeKind.Unspecified);

    private static DateTime WorkPeriodStartUtc(DateTime utc, TeamScheduleSettings settings, TimeZoneInfo tz)
    {
        var date = LocalDateOnly(utc, tz);
        return ToUtc(WorkPeriodStartLocal(date, settings), tz);
    }

    private static DateTime NextWorkPeriodStartUtc(DateTime utc, TeamScheduleSettings settings, TimeZoneInfo tz)
    {
        var date = LocalDateOnly(utc, tz).AddDays(1);
        return ToUtc(WorkPeriodStartLocal(date, settings), tz);
    }

    private static double LocalHourInWorkPeriod(DateTime utc, TeamScheduleSettings settings, TimeZoneInfo tz)
    {
        var local = ToLocal(utc, tz);
        var start = WorkPeriodStartLocal(DateOnly.FromDateTime(local), settings);
        return (local - start).TotalHours;
    }

    private static DateTime AlignToWorkingMoment(
        DateTime utc,
        TeamScheduleSettings settings,
        HashSet<DateOnly> holidays,
        TimeZoneInfo tz)
    {
        var current = utc;
        while (!IsWorkingDay(current, settings.WorkingDays, holidays, tz))
            current = NextWorkPeriodStartUtc(current, settings, tz);
        return current;
    }

    private static DateTime SnapToNextWorkSlot(
        DateTime utc,
        TeamScheduleSettings settings,
        HashSet<DateOnly> holidays,
        TimeZoneInfo tz)
    {
        var current = AlignToWorkingMoment(utc, settings, holidays, tz);
        var hoursPerDay = (double)settings.HoursPerDay;

        while (true)
        {
            var hourInPeriod = LocalHourInWorkPeriod(current, settings, tz);
            if (hourInPeriod < 0)
                current = WorkPeriodStartUtc(current, settings, tz);
            else if (hourInPeriod < hoursPerDay)
                return current;

            current = AlignToWorkingMoment(NextWorkPeriodStartUtc(current, settings, tz), settings, holidays, tz);
        }
    }

    private static bool IsWorkingDay(DateTime utc, int workingDays, HashSet<DateOnly> holidays, TimeZoneInfo tz)
    {
        var local = ToLocal(utc, tz);
        var date = DateOnly.FromDateTime(local);
        if (holidays.Contains(date)) return false;
        var dow = (int)local.DayOfWeek;
        return (workingDays & (1 << dow)) != 0;
    }

    private static DateTime AddWorkingHours(
        DateTime startUtc,
        decimal hours,
        TeamScheduleSettings settings,
        HashSet<DateOnly> holidays,
        TimeZoneInfo tz)
    {
        var remaining = hours;
        var current = startUtc;
        var hoursPerDay = (double)settings.HoursPerDay;

        while (remaining > 0)
        {
            if (!IsWorkingDay(current, settings.WorkingDays, holidays, tz))
            {
                current = AlignToWorkingMoment(NextWorkPeriodStartUtc(current, settings, tz), settings, holidays, tz);
                current = WorkPeriodStartUtc(current, settings, tz);
                continue;
            }

            var hourInPeriod = LocalHourInWorkPeriod(current, settings, tz);
            if (hourInPeriod < 0)
            {
                current = WorkPeriodStartUtc(current, settings, tz);
                hourInPeriod = 0;
            }

            if (hourInPeriod >= hoursPerDay)
            {
                current = AlignToWorkingMoment(NextWorkPeriodStartUtc(current, settings, tz), settings, holidays, tz);
                current = WorkPeriodStartUtc(current, settings, tz);
                continue;
            }

            var capacityToday = hoursPerDay - hourInPeriod;
            if (capacityToday <= 0)
            {
                current = AlignToWorkingMoment(NextWorkPeriodStartUtc(current, settings, tz), settings, holidays, tz);
                current = WorkPeriodStartUtc(current, settings, tz);
                continue;
            }

            var use = (decimal)Math.Min((double)remaining, capacityToday);
            remaining -= use;
            current = current.AddHours((double)use);

            if (remaining > 0)
            {
                current = AlignToWorkingMoment(NextWorkPeriodStartUtc(current, settings, tz), settings, holidays, tz);
                current = WorkPeriodStartUtc(current, settings, tz);
            }
        }

        return current;
    }
}
