using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Data;
using WMess.Api.Models;
using WMess.Api.Models.DTO.Teams;

namespace WMess.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TeamsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public TeamsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TeamResponse>>> GetTeams()
    {
        var teams = await _context.Teams
            .Select(t => new TeamResponse
            {
                Id = t.Id,
                Name = t.Name,
                CreatedAt = t.CreatedAt
            })
            .ToListAsync();

        return Ok(teams);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<TeamResponse>> GetTeam(int id)
    {
        var team = await _context.Teams.FindAsync(id);

        if (team == null)
        {
            return NotFound();
        }

        return Ok(new TeamResponse
        {
            Id = team.Id,
            Name = team.Name,
            CreatedAt = team.CreatedAt
        });
    }

    [HttpPost]
    public async Task<ActionResult<TeamResponse>> CreateTeam(CreateTeamRequest request)
    {
        var team = new Team
        {
            Name = request.Name,
            CreatedAt = DateTime.UtcNow
        };

        _context.Teams.Add(team);
        await _context.SaveChangesAsync();

        var response = new TeamResponse
        {
            Id = team.Id,
            Name = team.Name,
            CreatedAt = team.CreatedAt
        };

        return CreatedAtAction(nameof(GetTeam), new { id = team.Id }, response);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateTeam(int id, UpdateTeamRequest request)
    {
        var team = await _context.Teams.FindAsync(id);

        if (team == null)
        {
            return NotFound();
        }

        team.Name = request.Name;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!TeamExists(id))
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
    public async Task<IActionResult> DeleteTeam(int id)
    {
        var team = await _context.Teams.FindAsync(id);

        if (team == null)
        {
            return NotFound();
        }

        _context.Teams.Remove(team);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private bool TeamExists(int id)
    {
        return _context.Teams.Any(e => e.Id == id);
    }
}
