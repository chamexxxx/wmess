using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

    public ProjectsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProjectResponse>>> GetProjects()
    {
        var projects = await _context.Projects
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

        var team = await _context.Teams.FindAsync(request.TeamId);
        if (team == null)
        {
            return BadRequest(new { message = "Team not found" });
        }

        project.Name = request.Name;
        project.TeamId = request.TeamId;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!ProjectExists(id))
            {
                return NotFound();
            }
            else
            {
                throw;
            }
        }

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

        _context.Projects.Remove(project);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private bool ProjectExists(int id)
    {
        return _context.Projects.Any(e => e.Id == id);
    }
}
