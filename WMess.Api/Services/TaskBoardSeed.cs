using Microsoft.EntityFrameworkCore;
using WMess.Api.Data;
using WMess.Api.Models;

namespace WMess.Api.Services;

public static class TaskBoardSeed
{
    private static readonly (string Name, string Color, bool IsDone)[] DefaultColumns =
    [
        ("Нужно сделать", "#6B7280", false),
        ("В работе", "#3B82F6", false),
        ("Ревью", "#F59E0B", false),
        ("Готово", "#22C55E", true),
    ];

    private static readonly (string Name, string Color)[] DefaultGroups =
    [
        ("Разработка", "#3B82F6"),
        ("Арт", "#8B5CF6"),
        ("Общее", "#6B7280"),
    ];

    public static void AttachDefaults(Team team)
    {
        if (team.TaskBoardColumns.Count == 0)
            AddDefaultColumns(team.TaskBoardColumns);

        if (team.TaskGroups.Count == 0)
            AddDefaultGroups(team.TaskGroups);

        team.ScheduleSettings ??= new TeamScheduleSettings();
    }

    public static async Task EnsureColumnsAsync(ApplicationDbContext context, int teamId, CancellationToken ct = default)
    {
        if (await context.TaskBoardColumns.AnyAsync(c => c.TeamId == teamId, ct))
            return;

        for (var i = 0; i < DefaultColumns.Length; i++)
        {
            var (name, color, isDone) = DefaultColumns[i];
            context.TaskBoardColumns.Add(new TaskBoardColumn
            {
                Id = Guid.NewGuid(),
                TeamId = teamId,
                Name = name,
                Color = color,
                SortOrder = i,
                IsDoneColumn = isDone,
            });
        }

        await context.SaveChangesAsync(ct);
    }

    public static async Task EnsureGroupsAsync(ApplicationDbContext context, int teamId, CancellationToken ct = default)
    {
        if (await context.TaskGroups.AnyAsync(g => g.TeamId == teamId, ct))
            return;

        for (var i = 0; i < DefaultGroups.Length; i++)
        {
            var (name, color) = DefaultGroups[i];
            context.TaskGroups.Add(new TaskGroup
            {
                Id = Guid.NewGuid(),
                TeamId = teamId,
                Name = name,
                Color = color,
                SortOrder = i,
            });
        }

        await context.SaveChangesAsync(ct);
    }

    private static void AddDefaultColumns(ICollection<TaskBoardColumn> columns)
    {
        for (var i = 0; i < DefaultColumns.Length; i++)
        {
            var (name, color, isDone) = DefaultColumns[i];
            columns.Add(new TaskBoardColumn
            {
                Id = Guid.NewGuid(),
                Name = name,
                Color = color,
                SortOrder = i,
                IsDoneColumn = isDone,
            });
        }
    }

    private static void AddDefaultGroups(ICollection<TaskGroup> groups)
    {
        for (var i = 0; i < DefaultGroups.Length; i++)
        {
            var (name, color) = DefaultGroups[i];
            groups.Add(new TaskGroup
            {
                Id = Guid.NewGuid(),
                Name = name,
                Color = color,
                SortOrder = i,
            });
        }
    }

    public static async Task<Guid> GetDefaultColumnIdAsync(ApplicationDbContext context, int teamId, CancellationToken ct = default)
    {
        await EnsureColumnsAsync(context, teamId, ct);

        var columnId = await context.TaskBoardColumns
            .Where(c => c.TeamId == teamId && !c.IsDoneColumn)
            .OrderBy(c => c.SortOrder)
            .Select(c => c.Id)
            .FirstOrDefaultAsync(ct);

        if (columnId == Guid.Empty)
            throw new InvalidOperationException($"No board columns for team {teamId}");

        return columnId;
    }

    public static async Task<Guid> GetDefaultGroupIdAsync(ApplicationDbContext context, int teamId, CancellationToken ct = default)
    {
        await EnsureGroupsAsync(context, teamId, ct);

        var groupId = await context.TaskGroups
            .Where(g => g.TeamId == teamId)
            .OrderBy(g => g.SortOrder)
            .Select(g => g.Id)
            .FirstOrDefaultAsync(ct);

        if (groupId == Guid.Empty)
            throw new InvalidOperationException($"No task groups for team {teamId}");

        return groupId;
    }
}
