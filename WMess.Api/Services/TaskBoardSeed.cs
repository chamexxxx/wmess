using Microsoft.EntityFrameworkCore;
using WMess.Api.Data;
using WMess.Api.Models;

namespace WMess.Api.Services;

public static class TaskBoardSeed
{
    private static readonly (string Name, string Color, bool IsDone)[] DefaultColumns =
    [
        ("К выполнению", "#6B7280", false),
        ("В работе", "#3B82F6", false),
        ("Ревью", "#F59E0B", false),
        ("Готово", "#22C55E", true),
    ];

    private static readonly (string Name, string Color)[] DefaultLabels =
    [
        ("Баг", "#EF4444"),
        ("Дизайн", "#8B5CF6"),
        ("Готово", "#22C55E"),
        ("Нужен ревью", "#F59E0B"),
    ];

    public static void AttachDefaults(Team team)
    {
        if (team.TaskBoardColumns.Count == 0)
            AddDefaultColumns(team.TaskBoardColumns);

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

    public static void SeedLabels(ApplicationDbContext context, int teamId)
    {
        foreach (var (name, color) in DefaultLabels)
        {
            context.TaskLabelDefinitions.Add(new TaskLabelDefinition
            {
                Id = Guid.NewGuid(),
                TeamId = teamId,
                Name = name,
                Color = color,
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
}
