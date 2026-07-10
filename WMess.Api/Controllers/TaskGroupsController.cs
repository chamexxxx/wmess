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
[Route("api/teams/{teamId:int}/task-groups")]
public class TaskGroupsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAuthorizationService _authorizationService;

    public TaskGroupsController(ApplicationDbContext context, IAuthorizationService authorizationService)
    {
        _context = context;
        _authorizationService = authorizationService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TaskGroupResponse>>> GetGroups(int teamId)
    {
        if (!await IsMemberAsync(teamId)) return Forbid();

        await TaskBoardSeed.EnsureGroupsAsync(_context, teamId);

        var groups = await _context.TaskGroups
            .Where(g => g.TeamId == teamId)
            .OrderBy(g => g.SortOrder)
            .Select(g => new TaskGroupResponse
            {
                Id = g.Id,
                Name = g.Name,
                SortOrder = g.SortOrder,
                Color = g.Color
            })
            .ToListAsync();

        return Ok(groups);
    }

    [HttpPost]
    public async Task<ActionResult<TaskGroupResponse>> CreateGroup(int teamId, CreateTaskGroupRequest request)
    {
        if (!await CanManageAsync(teamId)) return Forbid();

        var maxSort = await _context.TaskGroups
            .Where(g => g.TeamId == teamId)
            .Select(g => (int?)g.SortOrder)
            .MaxAsync() ?? -1;

        var group = new TaskGroup
        {
            Id = Guid.NewGuid(),
            TeamId = teamId,
            Name = request.Name,
            Color = request.Color,
            SortOrder = maxSort + 1
        };

        _context.TaskGroups.Add(group);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetGroups), new { teamId }, new TaskGroupResponse
        {
            Id = group.Id,
            Name = group.Name,
            SortOrder = group.SortOrder,
            Color = group.Color
        });
    }

    [HttpPut("{groupId:guid}")]
    public async Task<IActionResult> UpdateGroup(int teamId, Guid groupId, UpdateTaskGroupRequest request)
    {
        if (!await CanManageAsync(teamId)) return Forbid();

        var group = await _context.TaskGroups.FirstOrDefaultAsync(g => g.Id == groupId && g.TeamId == teamId);
        if (group == null) return NotFound();

        group.Name = request.Name;
        group.Color = request.Color;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{groupId:guid}")]
    public async Task<IActionResult> DeleteGroup(int teamId, Guid groupId, [FromQuery] Guid? moveTo)
    {
        if (!await CanManageAsync(teamId)) return Forbid();

        var group = await _context.TaskGroups.FirstOrDefaultAsync(g => g.Id == groupId && g.TeamId == teamId);
        if (group == null) return NotFound();

        var fallback = moveTo ?? await _context.TaskGroups
            .Where(g => g.TeamId == teamId && g.Id != groupId)
            .OrderBy(g => g.SortOrder)
            .Select(g => g.Id)
            .FirstOrDefaultAsync();

        if (fallback == Guid.Empty)
            return BadRequest(new { message = "Cannot delete the last group" });

        var tasks = await _context.Tasks.Where(t => t.GroupId == groupId).ToListAsync();
        foreach (var task in tasks)
            task.GroupId = fallback;

        _context.TaskGroups.Remove(group);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("reorder")]
    public async Task<IActionResult> ReorderGroups(int teamId, ReorderTaskGroupsRequest request)
    {
        if (!await CanManageAsync(teamId)) return Forbid();

        var ids = request.Items.Select(i => i.Id).ToList();
        var groups = await _context.TaskGroups
            .Where(g => g.TeamId == teamId && ids.Contains(g.Id))
            .ToListAsync();

        foreach (var item in request.Items)
        {
            var g = groups.FirstOrDefault(x => x.Id == item.Id);
            if (g != null) g.SortOrder = item.SortOrder;
        }

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
