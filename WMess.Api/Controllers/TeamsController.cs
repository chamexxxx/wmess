using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Authorization;
using WMess.Api.Data;
using WMess.Api.Enums;
using WMess.Api.Models;
using WMess.Api.Models.DTO.Teams;
using WMess.Api.Services;

namespace WMess.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class TeamsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAuthorizationService _authorizationService;
    private readonly UserManager<ApplicationUser> _userManager;

    public TeamsController(
        ApplicationDbContext context,
        IAuthorizationService authorizationService,
        UserManager<ApplicationUser> userManager)
    {
        _context = context;
        _authorizationService = authorizationService;
        _userManager = userManager;
    }

    private string? GetCurrentUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier);

    private async Task<bool> IsLastOwnerAsync(int teamId)
    {
        var ownersCount = await _context.TeamUsers
            .CountAsync(tu => tu.TeamId == teamId && tu.Role == TeamRole.Owner);

        return ownersCount == 1;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TeamResponse>>> GetTeams()
    {
        if (GetCurrentUserId() is not { } userId)
            return Unauthorized();

        // Возвращаем только команды, в которых пользователь является участником
        var teams = await _context.TeamUsers
            .Where(tu => tu.UserId == userId)
            .Select(tu => new TeamResponse
            {
                Id = tu.Team.Id,
                Name = tu.Team.Name,
                CreatedAt = tu.Team.CreatedAt
            })
            .ToListAsync();

        return Ok(teams);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<TeamDetailResponse>> GetTeam(int id)
    {
        var team = await _context.Teams.FindAsync(id);
        if (team == null)
        {
            return NotFound();
        }

        var result = await _authorizationService.AuthorizeAsync(User, team, Policies.TeamMember);
        if (!result.Succeeded)
        {
            return Forbid();
        }

        // Политика TeamMember пройдена — значит запись о членстве существует.
        if (GetCurrentUserId() is not { } currentUserId)
            return Unauthorized();

        var role = await _context.TeamUsers
            .Where(tu => tu.TeamId == team.Id && tu.UserId == currentUserId)
            .Select(tu => (TeamRole?)tu.Role)
            .FirstOrDefaultAsync();

        return Ok(new TeamDetailResponse
        {
            Id = team.Id,
            Name = team.Name,
            CreatedAt = team.CreatedAt,
            Permissions = new TeamPermissions
            {
                CanManage = TeamRoleRules.CanManage(role),
                CanDelete = TeamRoleRules.CanDelete(role),
                CanChangeRoles = TeamRoleRules.CanChangeRoles(role),
                CanRemoveMembers = TeamRoleRules.CanRemoveMember(role, TeamRole.Member),
                CanRemoveAdmins = TeamRoleRules.CanRemoveMember(role, TeamRole.Admin),
                CanRemoveOwners = TeamRoleRules.CanRemoveMember(role, TeamRole.Owner)
            }
        });
    }

    [HttpPost]
    public async Task<ActionResult<TeamResponse>> CreateTeam(CreateTeamRequest request)
    {
        if (GetCurrentUserId() is not { } userId)
            return Unauthorized();

        // Создаём команду вместе с владельцем в одной транзакции
        var team = new Team
        {
            Name = request.Name,
            CreatedAt = DateTime.UtcNow,
            TeamUsers =
            {
                new TeamUser { UserId = userId, Role = TeamRole.Owner }
            }
        };

        TaskBoardSeed.AttachDefaults(team);
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

        var result = await _authorizationService.AuthorizeAsync(User, team, Policies.TeamManage);
        if (!result.Succeeded)
        {
            return Forbid();
        }

        team.Name = request.Name;
        await _context.SaveChangesAsync();

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

        var result = await _authorizationService.AuthorizeAsync(User, team, Policies.TeamDelete);
        if (!result.Succeeded)
        {
            return Forbid();
        }

        _context.Teams.Remove(team);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // === Управление участниками ===

    [HttpGet("{id}/members")]
    public async Task<ActionResult<IEnumerable<TeamMemberResponse>>> GetTeamMembers(int id)
    {
        var team = await _context.Teams.FindAsync(id);
        if (team == null)
        {
            return NotFound();
        }

        var result = await _authorizationService.AuthorizeAsync(User, team, Policies.TeamMember);
        if (!result.Succeeded)
        {
            return Forbid();
        }

        var members = await _context.TeamUsers
            .Where(tu => tu.TeamId == id)
            .Select(tu => new TeamMemberResponse
            {
                UserId = tu.UserId,
                Email = tu.User.Email!,
                Role = tu.Role
            })
            .ToListAsync();

        return Ok(members);
    }

    [HttpPost("{id}/members")]
    public async Task<IActionResult> AddMember(int id, AddMemberRequest request)
    {
        var team = await _context.Teams.FindAsync(id);
        if (team == null)
        {
            return NotFound();
        }

        var result = await _authorizationService.AuthorizeAsync(User, team, Policies.TeamManage);
        if (!result.Succeeded)
        {
            return Forbid();
        }

        var userToAdd = await _userManager.FindByEmailAsync(request.Email);
        if (userToAdd == null)
        {
            return NotFound(new { message = "User not found" });
        }

        var existingMember = await _context.TeamUsers
            .FirstOrDefaultAsync(tu => tu.TeamId == id && tu.UserId == userToAdd.Id);

        if (existingMember != null)
        {
            return BadRequest(new { message = "User is already a member of this team" });
        }

        var teamUser = new TeamUser
        {
            TeamId = id,
            UserId = userToAdd.Id,
            Role = TeamRole.Member
        };

        _context.TeamUsers.Add(teamUser);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id}/members/{memberId}")]
    public async Task<IActionResult> RemoveMember(int id, string memberId)
    {
        if (GetCurrentUserId() is not { } userId)
            return Unauthorized();

        var team = await _context.Teams.FindAsync(id);
        if (team == null)
        {
            return NotFound();
        }

        // Действующий пользователь должен быть участником команды
        var memberResult = await _authorizationService.AuthorizeAsync(User, team, Policies.TeamMember);
        if (!memberResult.Succeeded)
        {
            return Forbid();
        }

        var memberToRemove = await _context.TeamUsers
            .FirstOrDefaultAsync(tu => tu.TeamId == id && tu.UserId == memberId);

        if (memberToRemove == null)
        {
            return NotFound(new { message = "Member not found" });
        }

        // Удаление других участников: нужны права Owner/Admin,
        // при этом Admin не может трогать Owner или другого Admin
        if (memberId != userId)
        {
            var actor = await _context.TeamUsers
                .FirstAsync(tu => tu.TeamId == id && tu.UserId == userId);

            if (actor.Role is not (TeamRole.Owner or TeamRole.Admin))
            {
                return Forbid();
            }

            if (actor.Role == TeamRole.Admin && memberToRemove.Role is TeamRole.Admin or TeamRole.Owner)
            {
                return Forbid();
            }
        }

        // Нельзя удалить последнего Owner
        if (memberToRemove.Role == TeamRole.Owner && await IsLastOwnerAsync(id))
        {
            return BadRequest(new { message = "Cannot remove the last owner. Transfer ownership first." });
        }

        _context.TeamUsers.Remove(memberToRemove);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPut("{id}/members/{memberId}/role")]
    public async Task<IActionResult> UpdateMemberRole(int id, string memberId, UpdateMemberRoleRequest request)
    {
        var team = await _context.Teams.FindAsync(id);
        if (team == null)
        {
            return NotFound();
        }

        var result = await _authorizationService.AuthorizeAsync(User, team, Policies.TeamChangeRole);
        if (!result.Succeeded)
        {
            return Forbid();
        }

        if (GetCurrentUserId() is not { } userId)
            return Unauthorized();

        // Свою роль менять нельзя. Владелец расстаётся с ролью только через передачу
        // владения — назначив владельцем другого участника (ниже).
        if (memberId == userId)
        {
            return BadRequest(new { message = "Нельзя изменить свою собственную роль" });
        }

        var memberToUpdate = await _context.TeamUsers
            .FirstOrDefaultAsync(tu => tu.TeamId == id && tu.UserId == memberId);

        if (memberToUpdate == null)
        {
            return NotFound(new { message = "Member not found" });
        }

        // Передача владения: назначаемый становится владельцем, текущий владелец — администратором.
        // Владелец в команде всегда один.
        if (request.Role == TeamRole.Owner)
        {
            var actor = await _context.TeamUsers
                .FirstAsync(tu => tu.TeamId == id && tu.UserId == userId);

            memberToUpdate.Role = TeamRole.Owner;
            actor.Role = TeamRole.Admin;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // Нельзя понизить последнего Owner
        if (memberToUpdate.Role == TeamRole.Owner
            && await IsLastOwnerAsync(id))
        {
            return BadRequest(new { message = "Cannot downgrade the last owner. Transfer ownership first." });
        }

        memberToUpdate.Role = request.Role;
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
