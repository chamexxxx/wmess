using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Authorization;
using WMess.Api.Data;
using WMess.Api.Enums;
using WMess.Api.Models;
using WMess.Api.Models.DTO.Tasks;
using WMess.Api.Services;

namespace WMess.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class TasksController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAuthorizationService _authorizationService;
    private readonly UserManager<ApplicationUser> _userManager;

    public TasksController(
        ApplicationDbContext context,
        IAuthorizationService authorizationService,
        UserManager<ApplicationUser> userManager)
    {
        _context = context;
        _authorizationService = authorizationService;
        _userManager = userManager;
    }

    private string GetCurrentUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException("User ID not found in token");

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TaskResponse>>> GetTasks(
        int? projectId, int? teamId, string? scope)
    {
        var query = _context.Tasks
            .Include(t => t.Column)
            .Include(t => t.Assignments).ThenInclude(a => a.User)
            .Include(t => t.LabelAssignments).ThenInclude(la => la.Label)
            .AsQueryable();

        if (projectId.HasValue)
        {
            var project = await _context.Projects.FindAsync(projectId.Value);
            if (project == null) return NotFound();
            var auth = await _authorizationService.AuthorizeAsync(User, project, Policies.ProjectAccess);
            if (!auth.Succeeded) return Forbid();
            query = query.Where(t => t.ProjectId == projectId);
        }
        else if (teamId.HasValue)
        {
            var team = await _context.Teams.FindAsync(teamId.Value);
            if (team == null) return NotFound();
            var auth = await _authorizationService.AuthorizeAsync(User, team, Policies.TeamMember);
            if (!auth.Succeeded) return Forbid();

            if (string.Equals(scope, "all", StringComparison.OrdinalIgnoreCase))
            {
                var projectIds = await _context.Projects
                    .Where(p => p.TeamId == teamId)
                    .Select(p => p.Id)
                    .ToListAsync();
                query = query.Where(t =>
                    t.TeamId == teamId ||
                    (t.ProjectId != null && projectIds.Contains(t.ProjectId.Value)));
            }
            else
            {
                query = query.Where(t => t.TeamId == teamId && t.ProjectId == null);
            }
        }
        else
        {
            var userId = GetCurrentUserId();
            var userTeamIds = await _context.TeamUsers
                .Where(tu => tu.UserId == userId)
                .Select(tu => tu.TeamId)
                .ToListAsync();
            query = query.Where(t => t.TeamId != null && userTeamIds.Contains(t.TeamId.Value));
        }

        var tasks = await query
            .OrderBy(t => t.Column!.SortOrder)
            .ThenBy(t => t.SortOrder)
            .ToListAsync();

        return Ok(tasks.Select(MapToResponse));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TaskResponse>> GetTask(Guid id)
    {
        var task = await LoadTaskAsync(id);
        if (task == null) return NotFound();
        if (!await HasAccessAsync(task)) return Forbid();
        return Ok(MapToResponse(task));
    }

    [HttpPost]
    public async Task<ActionResult<TaskResponse>> CreateTask(CreateTaskRequest request)
    {
        var teamId = await ResolveTeamIdAsync(request.ProjectId, request.TeamId);
        if (teamId == null)
            return BadRequest(new { message = "Either ProjectId or TeamId must be provided" });

        if (!await AuthorizeTeamAccessAsync(teamId.Value, request.ProjectId))
            return Forbid();

        if (!await ValidateAssigneesAsync(teamId.Value, request.AssignedUserIds))
            return BadRequest(new { message = "One or more assignees are not team members" });

        var columnId = request.ColumnId ?? await TaskBoardSeed.GetDefaultColumnIdAsync(_context, teamId.Value);

        var maxSort = await _context.Tasks
            .Where(t => t.ColumnId == columnId)
            .Select(t => (int?)t.SortOrder)
            .MaxAsync() ?? -1;

        var task = new TaskItem
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Description = request.Description,
            Priority = request.Priority,
            ColumnId = columnId,
            SortOrder = maxSort + 1,
            StartDate = request.StartDate,
            DueDate = request.DueDate,
            EstimatedHours = request.EstimatedHours,
            ScheduleMode = request.ScheduleMode,
            ProjectId = request.ProjectId,
            TeamId = teamId,
            PrimaryAssigneeId = request.PrimaryAssigneeId ?? request.AssignedUserIds.FirstOrDefault(),
            CreatedById = GetCurrentUserId(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        foreach (var userId in request.AssignedUserIds.Distinct())
            task.Assignments.Add(new TaskAssignment { UserId = userId });

        await ApplyLabelsAsync(task, teamId.Value, request.LabelIds);
        _context.Tasks.Add(task);
        await _context.SaveChangesAsync();

        task = await LoadTaskAsync(task.Id);
        return CreatedAtAction(nameof(GetTask), new { id = task!.Id }, MapToResponse(task));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateTask(Guid id, UpdateTaskRequest request)
    {
        var task = await _context.Tasks
            .Include(t => t.Assignments)
            .Include(t => t.LabelAssignments)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (task == null) return NotFound();
        if (!await HasAccessAsync(task)) return Forbid();
        if (task.TeamId == null) return BadRequest(new { message = "Task has no team" });

        if (!await ValidateAssigneesAsync(task.TeamId.Value, request.AssignedUserIds))
            return BadRequest(new { message = "One or more assignees are not team members" });

        task.Title = request.Title;
        task.Description = request.Description;
        task.Priority = request.Priority;
        task.ColumnId = request.ColumnId;
        task.SortOrder = request.SortOrder;
        task.StartDate = request.StartDate;
        task.DueDate = request.DueDate;
        task.EstimatedHours = request.EstimatedHours;
        task.ScheduleMode = request.ScheduleMode;
        task.PrimaryAssigneeId = request.PrimaryAssigneeId;
        task.UpdatedAt = DateTime.UtcNow;

        _context.TaskAssignments.RemoveRange(task.Assignments);
        task.Assignments = request.AssignedUserIds.Distinct()
            .Select(uid => new TaskAssignment { TaskId = id, UserId = uid }).ToList();

        _context.TaskLabelAssignments.RemoveRange(task.LabelAssignments);
        await ApplyLabelsAsync(task, task.TeamId.Value, request.LabelIds);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<TaskResponse>> PatchTask(Guid id, PatchTaskRequest request)
    {
        var task = await LoadTaskAsync(id);
        if (task == null) return NotFound();
        if (!await HasAccessAsync(task)) return Forbid();

        if (request.Title != null) task.Title = request.Title;
        if (request.ColumnId.HasValue) task.ColumnId = request.ColumnId.Value;
        if (request.SortOrder.HasValue) task.SortOrder = request.SortOrder.Value;
        if (request.Priority.HasValue) task.Priority = request.Priority.Value;
        if (request.StartDate.HasValue) task.StartDate = request.StartDate;
        if (request.DueDate.HasValue) task.DueDate = request.DueDate;
        if (request.EstimatedHours.HasValue) task.EstimatedHours = request.EstimatedHours.Value;
        if (request.ScheduleMode.HasValue) task.ScheduleMode = request.ScheduleMode.Value;
        if (request.PrimaryAssigneeId != null) task.PrimaryAssigneeId = request.PrimaryAssigneeId;

        task.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        task = await LoadTaskAsync(id);
        return Ok(MapToResponse(task!));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteTask(Guid id)
    {
        var task = await _context.Tasks.FindAsync(id);
        if (task == null) return NotFound();
        if (!await HasManageAccessAsync(task)) return Forbid();

        _context.Tasks.Remove(task);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("{id:guid}/comments")]
    public async Task<ActionResult<IEnumerable<TaskCommentResponse>>> GetComments(Guid id)
    {
        var task = await _context.Tasks.FindAsync(id);
        if (task == null) return NotFound();
        if (!await HasAccessAsync(task)) return Forbid();

        var comments = await _context.TaskComments
            .Where(c => c.TaskId == id)
            .Include(c => c.User)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new TaskCommentResponse
            {
                Id = c.Id,
                Content = c.Content,
                CreatedAt = c.CreatedAt,
                UserId = c.UserId,
                UserEmail = c.User!.Email ?? ""
            })
            .ToListAsync();

        return Ok(comments);
    }

    [HttpPost("{id:guid}/comments")]
    public async Task<ActionResult<TaskCommentResponse>> AddComment(Guid id, CreateCommentRequest request)
    {
        var task = await _context.Tasks.FindAsync(id);
        if (task == null) return NotFound();
        if (!await HasAccessAsync(task)) return Forbid();

        var comment = new TaskComment
        {
            Id = Guid.NewGuid(),
            TaskId = id,
            Content = request.Content,
            UserId = GetCurrentUserId(),
            CreatedAt = DateTime.UtcNow
        };

        _context.TaskComments.Add(comment);
        await _context.SaveChangesAsync();

        var user = await _userManager.FindByIdAsync(comment.UserId);
        return CreatedAtAction(nameof(GetComments), new { id }, new TaskCommentResponse
        {
            Id = comment.Id,
            Content = comment.Content,
            CreatedAt = comment.CreatedAt,
            UserId = comment.UserId,
            UserEmail = user?.Email ?? ""
        });
    }

    [HttpDelete("{id:guid}/comments/{commentId:guid}")]
    public async Task<IActionResult> DeleteComment(Guid id, Guid commentId)
    {
        var comment = await _context.TaskComments.FirstOrDefaultAsync(c => c.Id == commentId && c.TaskId == id);
        if (comment == null) return NotFound();
        if (comment.UserId != GetCurrentUserId()) return Forbid();

        _context.TaskComments.Remove(comment);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private async Task<TaskItem?> LoadTaskAsync(Guid id) =>
        await _context.Tasks
            .Include(t => t.Column)
            .Include(t => t.PrimaryAssignee)
            .Include(t => t.Assignments).ThenInclude(a => a.User)
            .Include(t => t.LabelAssignments).ThenInclude(la => la.Label)
            .FirstOrDefaultAsync(t => t.Id == id);

    private async Task<int?> ResolveTeamIdAsync(int? projectId, int? teamId)
    {
        if (projectId.HasValue)
        {
            var project = await _context.Projects.FindAsync(projectId.Value);
            if (project == null) return null;
            return project.TeamId;
        }
        return teamId;
    }

    private async Task<bool> AuthorizeTeamAccessAsync(int teamId, int? projectId)
    {
        if (projectId.HasValue)
        {
            var project = await _context.Projects.FindAsync(projectId.Value);
            if (project == null) return false;
            return (await _authorizationService.AuthorizeAsync(User, project, Policies.ProjectAccess)).Succeeded;
        }
        var team = await _context.Teams.FindAsync(teamId);
        if (team == null) return false;
        return (await _authorizationService.AuthorizeAsync(User, team, Policies.TeamMember)).Succeeded;
    }

    private async Task<bool> HasAccessAsync(TaskItem task)
    {
        if (task.ProjectId.HasValue)
        {
            var project = await _context.Projects.FindAsync(task.ProjectId.Value);
            if (project == null) return false;
            return (await _authorizationService.AuthorizeAsync(User, project, Policies.ProjectAccess)).Succeeded;
        }
        if (task.TeamId.HasValue)
        {
            var team = await _context.Teams.FindAsync(task.TeamId.Value);
            if (team == null) return false;
            return (await _authorizationService.AuthorizeAsync(User, team, Policies.TeamMember)).Succeeded;
        }
        return false;
    }

    private async Task<bool> HasManageAccessAsync(TaskItem task)
    {
        if (task.ProjectId.HasValue)
        {
            var project = await _context.Projects.FindAsync(task.ProjectId.Value);
            if (project == null) return false;
            return (await _authorizationService.AuthorizeAsync(User, project, Policies.ProjectManage)).Succeeded;
        }
        if (task.TeamId.HasValue)
        {
            var team = await _context.Teams.FindAsync(task.TeamId.Value);
            if (team == null) return false;
            return (await _authorizationService.AuthorizeAsync(User, team, Policies.TeamManage)).Succeeded;
        }
        return false;
    }

    private async Task<bool> ValidateAssigneesAsync(int teamId, IEnumerable<string> userIds)
    {
        var ids = userIds.Distinct().ToList();
        if (ids.Count == 0) return true;
        var count = await _context.TeamUsers.CountAsync(tu => tu.TeamId == teamId && ids.Contains(tu.UserId));
        return count == ids.Count;
    }

    private async Task ApplyLabelsAsync(TaskItem task, int teamId, List<Guid> labelIds)
    {
        if (labelIds.Count == 0) return;
        var valid = await _context.TaskLabelDefinitions
            .Where(l => l.TeamId == teamId && labelIds.Contains(l.Id))
            .Select(l => l.Id)
            .ToListAsync();
        foreach (var labelId in valid)
            task.LabelAssignments.Add(new TaskLabelAssignment { LabelId = labelId });
    }

    private static TaskResponse MapToResponse(TaskItem t) => new()
    {
        Id = t.Id,
        Title = t.Title,
        Description = t.Description,
        Priority = t.Priority,
        ColumnId = t.ColumnId,
        ColumnName = t.Column?.Name ?? "",
        ColumnColor = t.Column?.Color ?? "#808080",
        IsDoneColumn = t.Column?.IsDoneColumn ?? false,
        SortOrder = t.SortOrder,
        StartDate = t.StartDate,
        DueDate = t.DueDate,
        EstimatedHours = t.EstimatedHours,
        ScheduleMode = t.ScheduleMode,
        PrimaryAssigneeId = t.PrimaryAssigneeId,
        PrimaryAssigneeEmail = t.PrimaryAssignee?.Email,
        CreatedAt = t.CreatedAt,
        UpdatedAt = t.UpdatedAt,
        ProjectId = t.ProjectId,
        TeamId = t.TeamId,
        CreatedById = t.CreatedById,
        AssignedUserIds = t.Assignments.Select(a => a.UserId).ToList(),
        Assignees = t.Assignments.Select(a => new TaskAssigneeResponse
        {
            UserId = a.UserId,
            Email = a.User?.Email ?? ""
        }).ToList(),
        Labels = t.LabelAssignments.Select(la => new TaskLabelResponse
        {
            Id = la.Label!.Id,
            Name = la.Label.Name,
            Color = la.Label.Color
        }).ToList()
    };
}
