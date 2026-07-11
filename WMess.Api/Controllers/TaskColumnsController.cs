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
[Route("api/teams/{teamId:int}/task-columns")]
public class TaskColumnsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAuthorizationService _authorizationService;
    private readonly ITasksChangeNotifier _tasksNotifier;

    public TaskColumnsController(
        ApplicationDbContext context,
        IAuthorizationService authorizationService,
        ITasksChangeNotifier tasksNotifier)
    {
        _context = context;
        _authorizationService = authorizationService;
        _tasksNotifier = tasksNotifier;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TaskBoardColumnResponse>>> GetColumns(int teamId)
    {
        if (!await IsMemberAsync(teamId)) return Forbid();

        if (!await _context.TaskBoardColumns.AnyAsync(c => c.TeamId == teamId))
            await TaskBoardSeed.EnsureColumnsAsync(_context, teamId);

        var columns = await _context.TaskBoardColumns
            .Where(c => c.TeamId == teamId)
            .OrderBy(c => c.SortOrder)
            .Select(c => new TaskBoardColumnResponse
            {
                Id = c.Id,
                Name = c.Name,
                SortOrder = c.SortOrder,
                Color = c.Color,
                IsDoneColumn = c.IsDoneColumn
            })
            .ToListAsync();

        return Ok(columns);
    }

    [HttpPost]
    public async Task<ActionResult<TaskBoardColumnResponse>> CreateColumn(int teamId, CreateTaskColumnRequest request)
    {
        if (!await CanManageAsync(teamId)) return Forbid();

        var maxSort = await _context.TaskBoardColumns
            .Where(c => c.TeamId == teamId)
            .Select(c => (int?)c.SortOrder)
            .MaxAsync() ?? -1;

        var column = new TaskBoardColumn
        {
            Id = Guid.NewGuid(),
            TeamId = teamId,
            Name = request.Name,
            Color = request.Color,
            IsDoneColumn = request.IsDoneColumn,
            SortOrder = maxSort + 1
        };

        _context.TaskBoardColumns.Add(column);
        await _context.SaveChangesAsync();
        await _tasksNotifier.NotifyChangedAsync(teamId);

        return CreatedAtAction(nameof(GetColumns), new { teamId }, new TaskBoardColumnResponse
        {
            Id = column.Id,
            Name = column.Name,
            SortOrder = column.SortOrder,
            Color = column.Color,
            IsDoneColumn = column.IsDoneColumn
        });
    }

    [HttpPut("{columnId:guid}")]
    public async Task<IActionResult> UpdateColumn(int teamId, Guid columnId, UpdateTaskColumnRequest request)
    {
        if (!await CanManageAsync(teamId)) return Forbid();

        var column = await _context.TaskBoardColumns.FirstOrDefaultAsync(c => c.Id == columnId && c.TeamId == teamId);
        if (column == null) return NotFound();

        column.Name = request.Name;
        column.Color = request.Color;
        column.IsDoneColumn = request.IsDoneColumn;
        await _context.SaveChangesAsync();
        await _tasksNotifier.NotifyChangedAsync(teamId);
        return NoContent();
    }

    [HttpPut("reorder")]
    public async Task<IActionResult> ReorderColumns(int teamId, ReorderTaskColumnsRequest request)
    {
        if (!await CanManageAsync(teamId)) return Forbid();

        var ids = request.Items.Select(i => i.Id).ToList();
        var columns = await _context.TaskBoardColumns
            .Where(c => c.TeamId == teamId && ids.Contains(c.Id))
            .ToListAsync();

        foreach (var item in request.Items)
        {
            var col = columns.FirstOrDefault(c => c.Id == item.Id);
            if (col != null) col.SortOrder = item.SortOrder;
        }

        await _context.SaveChangesAsync();
        await _tasksNotifier.NotifyChangedAsync(teamId);
        return NoContent();
    }

    [HttpDelete("{columnId:guid}")]
    public async Task<IActionResult> DeleteColumn(int teamId, Guid columnId, [FromQuery] Guid? moveTo)
    {
        if (!await CanManageAsync(teamId)) return Forbid();

        var column = await _context.TaskBoardColumns.FirstOrDefaultAsync(c => c.Id == columnId && c.TeamId == teamId);
        if (column == null) return NotFound();

        var taskCount = await _context.Tasks.CountAsync(t => t.ColumnId == columnId);
        if (taskCount > 0)
        {
            if (!moveTo.HasValue)
                return BadRequest(new { message = "Column has tasks. Provide moveTo column id." });

            var target = await _context.TaskBoardColumns.FirstOrDefaultAsync(c => c.Id == moveTo && c.TeamId == teamId);
            if (target == null) return BadRequest(new { message = "Target column not found" });

            var tasks = await _context.Tasks.Where(t => t.ColumnId == columnId).ToListAsync();
            var maxSort = await _context.Tasks.Where(t => t.ColumnId == moveTo).MaxAsync(t => (int?)t.SortOrder) ?? -1;
            foreach (var task in tasks)
            {
                task.ColumnId = moveTo.Value;
                task.SortOrder = ++maxSort;
            }
        }

        _context.TaskBoardColumns.Remove(column);
        await _context.SaveChangesAsync();
        await _tasksNotifier.NotifyChangedAsync(teamId);
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
