using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Authorization;
using WMess.Api.Data;
using WMess.Api.Models;
using WMess.Api.Models.DTO.Projects;

namespace WMess.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class ProjectsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAuthorizationService _authorizationService;

    public ProjectsController(
        ApplicationDbContext context,
        IAuthorizationService authorizationService)
    {
        _context = context;
        _authorizationService = authorizationService;
    }

    private string GetCurrentUserId()
    {
        return User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("User ID not found in token");
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProjectResponse>>> GetProjects()
    {
        var userId = GetCurrentUserId();

        // Возвращаем только проекты из команд, в которых пользователь является участником
        var projects = await _context.TeamUsers
            .Where(tu => tu.UserId == userId)
            .SelectMany(tu => tu.Team.Projects)
            .Select(p => new ProjectResponse
            {
                Id = p.Id,
                Name = p.Name,
                TeamId = p.TeamId,
                CreatedAt = p.CreatedAt
            })
            .ToListAsync();

        return Ok(projects);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ProjectResponse>> GetProject(int id)
    {
        var project = await _context.Projects.FindAsync(id);
        if (project == null)
        {
            return NotFound();
        }

        var result = await _authorizationService.AuthorizeAsync(User, project, Policies.ProjectAccess);
        if (!result.Succeeded)
        {
            return Forbid();
        }

        return Ok(new ProjectResponse
        {
            Id = project.Id,
            Name = project.Name,
            TeamId = project.TeamId,
            CreatedAt = project.CreatedAt
        });
    }

    [HttpPost]
    public async Task<ActionResult<ProjectResponse>> CreateProject(CreateProjectRequest request)
    {
        var team = await _context.Teams.FindAsync(request.TeamId);
        if (team == null)
        {
            return BadRequest(new { message = "Team not found" });
        }

        var result = await _authorizationService.AuthorizeAsync(User, team, Policies.TeamManage);
        if (!result.Succeeded)
        {
            return Forbid();
        }

        var project = new Project
        {
            Name = request.Name,
            TeamId = request.TeamId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Projects.Add(project);
        await _context.SaveChangesAsync();

        var response = new ProjectResponse
        {
            Id = project.Id,
            Name = project.Name,
            TeamId = project.TeamId,
            CreatedAt = project.CreatedAt
        };

        return CreatedAtAction(nameof(GetProject), new { id = project.Id }, response);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateProject(int id, UpdateProjectRequest request)
    {
        var project = await _context.Projects.FindAsync(id);
        if (project == null)
        {
            return NotFound();
        }

        var result = await _authorizationService.AuthorizeAsync(User, project, Policies.ProjectManage);
        if (!result.Succeeded)
        {
            return Forbid();
        }

        // Если меняется TeamId, нужны права управления в целевой команде
        if (request.TeamId != project.TeamId)
        {
            var targetTeam = await _context.Teams.FindAsync(request.TeamId);
            if (targetTeam == null)
            {
                return BadRequest(new { message = "Target team not found" });
            }

            var teamResult = await _authorizationService.AuthorizeAsync(User, targetTeam, Policies.TeamManage);
            if (!teamResult.Succeeded)
            {
                return Forbid();
            }
        }

        project.Name = request.Name;
        project.TeamId = request.TeamId;

        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProject(int id)
    {
        var project = await _context.Projects.FindAsync(id);
        if (project == null)
        {
            return NotFound();
        }

        var result = await _authorizationService.AuthorizeAsync(User, project, Policies.ProjectManage);
        if (!result.Succeeded)
        {
            return Forbid();
        }

        _context.Projects.Remove(project);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
