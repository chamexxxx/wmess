using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Authorization;
using WMess.Api.Data;
using WMess.Api.Models;
using WMess.Api.Models.DTO.Documents;

namespace WMess.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class DocumentsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAuthorizationService _authorizationService;
    private readonly UserManager<IdentityUser> _userManager;

    public DocumentsController(
        ApplicationDbContext context,
        IAuthorizationService authorizationService,
        UserManager<IdentityUser> userManager)
    {
        _context = context;
        _authorizationService = authorizationService;
        _userManager = userManager;
    }

    private string GetCurrentUserId()
    {
        return User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("User ID not found in token");
    }

    private readonly record struct DocumentRights(bool CanView, bool CanEdit, bool CanManage);

    /// <summary>
    /// Комбинирует ролевой доступ к проекту с персональными правами <see cref="DocumentPermission"/>.
    /// Иерархия: manage ⇒ edit ⇒ view. Требует загруженный <see cref="Document.Project"/>.
    /// </summary>
    private async Task<DocumentRights> GetRightsAsync(Document document, string userId)
    {
        var manageProject = (await _authorizationService.AuthorizeAsync(User, document.Project, Policies.ProjectManage)).Succeeded;
        var accessProject = manageProject
            || (await _authorizationService.AuthorizeAsync(User, document.Project, Policies.ProjectAccess)).Succeeded;

        var permission = await _context.DocumentPermissions
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.DocumentId == document.Id && p.UserId == userId);

        var canManage = manageProject || (permission?.CanManage ?? false);
        var canEdit = canManage || (permission?.CanEdit ?? false);
        var canView = canEdit || accessProject || (permission?.CanView ?? false);

        return new DocumentRights(canView, canEdit, canManage);
    }

    #region Folders

    [HttpGet("folders/project/{projectId}")]
    [EndpointName("GetProjectFolders")]
    public async Task<ActionResult<IEnumerable<FolderResponse>>> GetProjectFolders(int projectId)
    {
        var project = await _context.Projects.FindAsync(projectId);
        if (project == null)
        {
            return NotFound();
        }

        var result = await _authorizationService.AuthorizeAsync(User, project, Policies.ProjectAccess);
        if (!result.Succeeded)
        {
            return Forbid();
        }

        var folders = await _context.DocumentFolders
            .Where(f => f.ProjectId == projectId)
            .Select(f => new FolderResponse
            {
                Id = f.Id,
                ProjectId = f.ProjectId,
                ParentFolderId = f.ParentFolderId,
                Name = f.Name,
                CreatedAt = f.CreatedAt,
                UpdatedAt = f.UpdatedAt
            })
            .ToListAsync();

        return Ok(folders);
    }

    [HttpGet("folders/{id}")]
    [EndpointName("GetFolder")]
    public async Task<ActionResult<FolderResponse>> GetFolder(int id)
    {
        var folder = await _context.DocumentFolders
            .Include(f => f.Project)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (folder == null)
        {
            return NotFound();
        }

        var result = await _authorizationService.AuthorizeAsync(User, folder.Project, Policies.ProjectAccess);
        if (!result.Succeeded)
        {
            return Forbid();
        }

        return Ok(new FolderResponse
        {
            Id = folder.Id,
            ProjectId = folder.ProjectId,
            ParentFolderId = folder.ParentFolderId,
            Name = folder.Name,
            CreatedAt = folder.CreatedAt,
            UpdatedAt = folder.UpdatedAt
        });
    }

    [HttpPost("folders")]
    [EndpointName("CreateFolder")]
    public async Task<ActionResult<FolderResponse>> CreateFolder(CreateFolderRequest request)
    {
        var project = await _context.Projects.FindAsync(request.ProjectId);
        if (project == null)
        {
            return BadRequest(new { message = "Project not found" });
        }

        var result = await _authorizationService.AuthorizeAsync(User, project, Policies.ProjectManage);
        if (!result.Succeeded)
        {
            return Forbid();
        }

        if (request.ParentFolderId.HasValue)
        {
            var parentFolder = await _context.DocumentFolders.FindAsync(request.ParentFolderId.Value);
            if (parentFolder == null || parentFolder.ProjectId != request.ProjectId)
            {
                return BadRequest(new { message = "Parent folder not found or doesn't belong to this project" });
            }
        }

        var folder = new DocumentFolder
        {
            ProjectId = request.ProjectId,
            ParentFolderId = request.ParentFolderId,
            Name = request.Name,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.DocumentFolders.Add(folder);
        await _context.SaveChangesAsync();

        var response = new FolderResponse
        {
            Id = folder.Id,
            ProjectId = folder.ProjectId,
            ParentFolderId = folder.ParentFolderId,
            Name = folder.Name,
            CreatedAt = folder.CreatedAt,
            UpdatedAt = folder.UpdatedAt
        };

        return CreatedAtAction(nameof(GetFolder), new { id = folder.Id }, response);
    }

    [HttpPut("folders/{id}")]
    [EndpointName("UpdateFolder")]
    public async Task<IActionResult> UpdateFolder(int id, UpdateFolderRequest request)
    {
        var folder = await _context.DocumentFolders
            .Include(f => f.Project)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (folder == null)
        {
            return NotFound();
        }

        var result = await _authorizationService.AuthorizeAsync(User, folder.Project, Policies.ProjectManage);
        if (!result.Succeeded)
        {
            return Forbid();
        }

        // Только переименование. Перемещение — отдельный эндпоинт MoveFolder,
        // чтобы переименование случайно не сбрасывало родителя.
        folder.Name = request.Name;
        folder.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPut("folders/{id}/move")]
    [EndpointName("MoveFolder")]
    public async Task<IActionResult> MoveFolder(int id, MoveFolderRequest request)
    {
        var folder = await _context.DocumentFolders
            .Include(f => f.Project)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (folder == null)
        {
            return NotFound();
        }

        var result = await _authorizationService.AuthorizeAsync(User, folder.Project, Policies.ProjectManage);
        if (!result.Succeeded)
        {
            return Forbid();
        }

        if (request.ParentFolderId.HasValue)
        {
            if (request.ParentFolderId.Value == folder.Id)
            {
                return BadRequest(new { message = "Папка не может быть родителем самой себя" });
            }

            var parentFolder = await _context.DocumentFolders.FindAsync(request.ParentFolderId.Value);
            if (parentFolder == null || parentFolder.ProjectId != folder.ProjectId)
            {
                return BadRequest(new { message = "Родительская папка не найдена или не принадлежит этому проекту" });
            }

            // Новая родительская папка не должна быть потомком перемещаемой (защита от цикла).
            var currentParentId = parentFolder.ParentFolderId;
            while (currentParentId.HasValue)
            {
                if (currentParentId.Value == folder.Id)
                {
                    return BadRequest(new { message = "Нельзя переместить папку в её потомка" });
                }
                var ancestor = await _context.DocumentFolders.FindAsync(currentParentId.Value);
                currentParentId = ancestor?.ParentFolderId;
            }
        }

        folder.ParentFolderId = request.ParentFolderId;
        folder.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("folders/{id}")]
    [EndpointName("DeleteFolder")]
    public async Task<IActionResult> DeleteFolder(int id)
    {
        var folder = await _context.DocumentFolders
            .Include(f => f.Project)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (folder == null)
        {
            return NotFound();
        }

        var result = await _authorizationService.AuthorizeAsync(User, folder.Project, Policies.ProjectManage);
        if (!result.Succeeded)
        {
            return Forbid();
        }

        _context.DocumentFolders.Remove(folder);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    #endregion

    #region Documents

    [HttpGet("project/{projectId}")]
    [EndpointName("GetProjectDocuments")]
    public async Task<ActionResult<IEnumerable<DocumentResponse>>> GetProjectDocuments(int projectId)
    {
        var project = await _context.Projects.FindAsync(projectId);
        if (project == null)
        {
            return NotFound();
        }

        var result = await _authorizationService.AuthorizeAsync(User, project, Policies.ProjectAccess);
        if (!result.Succeeded)
        {
            return Forbid();
        }

        var documents = await _context.Documents
            .Where(d => d.ProjectId == projectId)
            .Select(d => new DocumentResponse
            {
                Id = d.Id,
                ProjectId = d.ProjectId,
                FolderId = d.FolderId,
                Title = d.Title,
                CreatedBy = d.CreatedBy,
                CreatedAt = d.CreatedAt,
                UpdatedAt = d.UpdatedAt
            })
            .ToListAsync();

        return Ok(documents);
    }

    [HttpGet("{id}")]
    [EndpointName("GetDocument")]
    public async Task<ActionResult<DocumentResponse>> GetDocument(int id)
    {
        var document = await _context.Documents
            .Include(d => d.Project)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (document == null)
        {
            return NotFound();
        }

        var rights = await GetRightsAsync(document, GetCurrentUserId());
        if (!rights.CanView)
        {
            return Forbid();
        }

        return Ok(new DocumentResponse
        {
            Id = document.Id,
            ProjectId = document.ProjectId,
            FolderId = document.FolderId,
            Title = document.Title,
            CreatedBy = document.CreatedBy,
            CreatedAt = document.CreatedAt,
            UpdatedAt = document.UpdatedAt
        });
    }

    [HttpGet("{id}/content")]
    [EndpointName("GetDocumentContent")]
    public async Task<ActionResult<byte[]>> GetDocumentContent(int id)
    {
        var document = await _context.Documents
            .Include(d => d.Project)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (document == null)
        {
            return NotFound();
        }

        var rights = await GetRightsAsync(document, GetCurrentUserId());
        if (!rights.CanView)
        {
            return Forbid();
        }

        return Ok(document.YjsState ?? Array.Empty<byte>());
    }

    [HttpPost]
    [EndpointName("CreateDocument")]
    public async Task<ActionResult<DocumentResponse>> CreateDocument(CreateDocumentRequest request)
    {
        var project = await _context.Projects.FindAsync(request.ProjectId);
        if (project == null)
        {
            return BadRequest(new { message = "Project not found" });
        }

        var result = await _authorizationService.AuthorizeAsync(User, project, Policies.ProjectManage);
        if (!result.Succeeded)
        {
            return Forbid();
        }

        if (request.FolderId.HasValue)
        {
            var folder = await _context.DocumentFolders.FindAsync(request.FolderId.Value);
            if (folder == null || folder.ProjectId != request.ProjectId)
            {
                return BadRequest(new { message = "Folder not found or doesn't belong to this project" });
            }
        }

        var userId = GetCurrentUserId();

        var document = new Document
        {
            ProjectId = request.ProjectId,
            FolderId = request.FolderId,
            Title = request.Title,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            YjsState = null
        };

        _context.Documents.Add(document);
        await _context.SaveChangesAsync();

        // Создателю выдаём полные права на документ.
        var permission = new DocumentPermission
        {
            DocumentId = document.Id,
            UserId = userId,
            CanView = true,
            CanEdit = true,
            CanManage = true,
            GrantedAt = DateTime.UtcNow
        };

        _context.DocumentPermissions.Add(permission);
        await _context.SaveChangesAsync();

        var response = new DocumentResponse
        {
            Id = document.Id,
            ProjectId = document.ProjectId,
            FolderId = document.FolderId,
            Title = document.Title,
            CreatedBy = document.CreatedBy,
            CreatedAt = document.CreatedAt,
            UpdatedAt = document.UpdatedAt
        };

        return CreatedAtAction(nameof(GetDocument), new { id = document.Id }, response);
    }

    [HttpPut("{id}")]
    [EndpointName("UpdateDocument")]
    public async Task<IActionResult> UpdateDocument(int id, UpdateDocumentRequest request)
    {
        var document = await _context.Documents
            .Include(d => d.Project)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (document == null)
        {
            return NotFound();
        }

        var rights = await GetRightsAsync(document, GetCurrentUserId());
        if (!rights.CanManage)
        {
            return Forbid();
        }

        // Только переименование. Перемещение — отдельный эндпоинт MoveDocument.
        document.Title = request.Title;
        document.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPut("{id}/move")]
    [EndpointName("MoveDocument")]
    public async Task<IActionResult> MoveDocument(int id, MoveDocumentRequest request)
    {
        var document = await _context.Documents
            .Include(d => d.Project)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (document == null)
        {
            return NotFound();
        }

        var rights = await GetRightsAsync(document, GetCurrentUserId());
        if (!rights.CanManage)
        {
            return Forbid();
        }

        if (request.FolderId.HasValue)
        {
            var folder = await _context.DocumentFolders.FindAsync(request.FolderId.Value);
            if (folder == null || folder.ProjectId != document.ProjectId)
            {
                return BadRequest(new { message = "Folder not found or doesn't belong to this project" });
            }
        }

        document.FolderId = request.FolderId;
        document.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id}")]
    [EndpointName("DeleteDocument")]
    public async Task<IActionResult> DeleteDocument(int id)
    {
        var document = await _context.Documents
            .Include(d => d.Project)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (document == null)
        {
            return NotFound();
        }

        var rights = await GetRightsAsync(document, GetCurrentUserId());
        if (!rights.CanManage)
        {
            return Forbid();
        }

        _context.Documents.Remove(document);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPut("{id}/state")]
    [EndpointName("UpdateDocumentState")]
    public async Task<IActionResult> UpdateDocumentState(int id, [FromBody] byte[] state)
    {
        var document = await _context.Documents
            .Include(d => d.Project)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (document == null)
        {
            return NotFound();
        }

        var rights = await GetRightsAsync(document, GetCurrentUserId());
        if (!rights.CanEdit)
        {
            return Forbid();
        }

        document.YjsState = state;
        document.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return NoContent();
    }

    #endregion

    #region Permissions

    [HttpGet("{id}/permissions")]
    [EndpointName("GetDocumentPermissions")]
    public async Task<ActionResult<IEnumerable<PermissionResponse>>> GetDocumentPermissions(int id)
    {
        var document = await _context.Documents
            .Include(d => d.Project)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (document == null)
        {
            return NotFound();
        }

        var rights = await GetRightsAsync(document, GetCurrentUserId());
        if (!rights.CanManage)
        {
            return Forbid();
        }

        var permissions = await _context.DocumentPermissions
            .Where(p => p.DocumentId == id)
            .Include(p => p.User)
            .Select(p => new PermissionResponse
            {
                Id = p.Id,
                DocumentId = p.DocumentId,
                UserId = p.UserId,
                UserEmail = p.User.Email ?? "",
                CanView = p.CanView,
                CanEdit = p.CanEdit,
                CanManage = p.CanManage,
                GrantedAt = p.GrantedAt
            })
            .ToListAsync();

        return Ok(permissions);
    }

    [HttpPost("{id}/permissions")]
    [EndpointName("SetDocumentPermission")]
    public async Task<ActionResult<PermissionResponse>> SetDocumentPermission(int id, SetPermissionRequest request)
    {
        var document = await _context.Documents
            .Include(d => d.Project)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (document == null)
        {
            return NotFound();
        }

        var rights = await GetRightsAsync(document, GetCurrentUserId());
        if (!rights.CanManage)
        {
            return Forbid();
        }

        var user = await _userManager.FindByIdAsync(request.UserId);
        if (user == null)
        {
            return BadRequest(new { message = "User not found" });
        }

        var existingPermission = await _context.DocumentPermissions
            .FirstOrDefaultAsync(p => p.DocumentId == id && p.UserId == request.UserId);

        if (existingPermission != null)
        {
            existingPermission.CanView = request.CanView;
            existingPermission.CanEdit = request.CanEdit;
            existingPermission.CanManage = request.CanManage;
            existingPermission.GrantedAt = DateTime.UtcNow;
        }
        else
        {
            var permission = new DocumentPermission
            {
                DocumentId = id,
                UserId = request.UserId,
                CanView = request.CanView,
                CanEdit = request.CanEdit,
                CanManage = request.CanManage,
                GrantedAt = DateTime.UtcNow
            };

            _context.DocumentPermissions.Add(permission);
        }

        await _context.SaveChangesAsync();

        var updatedPermission = await _context.DocumentPermissions
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.DocumentId == id && p.UserId == request.UserId);

        return Ok(new PermissionResponse
        {
            Id = updatedPermission!.Id,
            DocumentId = updatedPermission.DocumentId,
            UserId = updatedPermission.UserId,
            UserEmail = updatedPermission.User.Email ?? "",
            CanView = updatedPermission.CanView,
            CanEdit = updatedPermission.CanEdit,
            CanManage = updatedPermission.CanManage,
            GrantedAt = updatedPermission.GrantedAt
        });
    }

    [HttpDelete("{id}/permissions/{userId}")]
    [EndpointName("RemoveDocumentPermission")]
    public async Task<IActionResult> RemoveDocumentPermission(int id, string userId)
    {
        var document = await _context.Documents
            .Include(d => d.Project)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (document == null)
        {
            return NotFound();
        }

        var rights = await GetRightsAsync(document, GetCurrentUserId());
        if (!rights.CanManage)
        {
            return Forbid();
        }

        var permission = await _context.DocumentPermissions
            .FirstOrDefaultAsync(p => p.DocumentId == id && p.UserId == userId);

        if (permission == null)
        {
            return NotFound();
        }

        _context.DocumentPermissions.Remove(permission);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    #endregion
}
