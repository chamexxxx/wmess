using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Authorization;
using WMess.Api.Data;
using WMess.Api.Infrastructure;
using WMess.Api.Models;
using WMess.Api.Models.DTO.Library;
using WMess.Api.Services;

namespace WMess.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class LibraryController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAuthorizationService _authorizationService;
    private readonly ILibraryAccessService _libraryAccess;
    private readonly UserManager<IdentityUser> _userManager;

    public LibraryController(
        ApplicationDbContext context,
        IAuthorizationService authorizationService,
        ILibraryAccessService libraryAccess,
        UserManager<IdentityUser> userManager)
    {
        _context = context;
        _authorizationService = authorizationService;
        _libraryAccess = libraryAccess;
        _userManager = userManager;
    }

    private string GetCurrentUserId()
    {
        return User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("User ID not found in token");
    }

    private static string TypeName(LibraryItemType type) => type switch
    {
        LibraryItemType.Document => "document",
        LibraryItemType.Board => "board",
        LibraryItemType.Table => "table",
        _ => type.ToString().ToLowerInvariant(),
    };

    private static LibraryItemResponse ToItemResponse(LibraryItem item) => new()
    {
        Id = item.Id,
        ProjectId = item.ProjectId,
        FolderId = item.FolderId,
        Type = TypeName(item.Type),
        Title = item.Title,
        CreatedBy = item.CreatedBy,
        CreatedAt = item.CreatedAt,
        UpdatedAt = item.UpdatedAt
    };

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

        var folders = await _context.LibraryFolders
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
        var folder = await _context.LibraryFolders
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
            var parentFolder = await _context.LibraryFolders.FindAsync(request.ParentFolderId.Value);
            if (parentFolder == null || parentFolder.ProjectId != request.ProjectId)
            {
                return BadRequest(new { message = "Parent folder not found or doesn't belong to this project" });
            }
        }

        var folder = new LibraryFolder
        {
            ProjectId = request.ProjectId,
            ParentFolderId = request.ParentFolderId,
            Name = request.Name,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.LibraryFolders.Add(folder);
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
        var folder = await _context.LibraryFolders
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
        var folder = await _context.LibraryFolders
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

            var parentFolder = await _context.LibraryFolders.FindAsync(request.ParentFolderId.Value);
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
                var ancestor = await _context.LibraryFolders.FindAsync(currentParentId.Value);
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
        var folder = await _context.LibraryFolders
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

        // Удаляем всё поддерево: саму папку, вложенные папки и элементы внутри них.
        // Папок в проекте обычно немного — собираем дерево в памяти.
        var projectFolders = await _context.LibraryFolders
            .Where(f => f.ProjectId == folder.ProjectId)
            .Select(f => new { f.Id, f.ParentFolderId })
            .ToListAsync();

        var folderIds = new HashSet<int> { folder.Id };
        var queue = new Queue<int>();
        queue.Enqueue(folder.Id);
        while (queue.Count > 0)
        {
            var currentId = queue.Dequeue();
            foreach (var child in projectFolders.Where(f => f.ParentFolderId == currentId))
            {
                if (folderIds.Add(child.Id))
                {
                    queue.Enqueue(child.Id);
                }
            }
        }

        // Элементы внутри удаляемых папок (их контент и LibraryPermission снимаются каскадно).
        var items = await _context.LibraryItems
            .Where(d => d.FolderId != null && folderIds.Contains(d.FolderId.Value))
            .ToListAsync();
        _context.LibraryItems.RemoveRange(items);

        var folders = await _context.LibraryFolders
            .Where(f => folderIds.Contains(f.Id))
            .ToListAsync();
        _context.LibraryFolders.RemoveRange(folders);

        await _context.SaveChangesAsync();

        return NoContent();
    }

    #endregion

    #region Items

    [HttpGet("project/{projectId}/items")]
    [EndpointName("GetProjectItems")]
    public async Task<ActionResult<IEnumerable<LibraryItemResponse>>> GetProjectItems(int projectId, [FromQuery] LibraryItemType? type)
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

        var query = _context.LibraryItems.Where(d => d.ProjectId == projectId);
        if (type.HasValue)
        {
            query = query.Where(d => d.Type == type.Value);
        }

        var items = await query
            .OrderBy(d => d.Title)
            .Select(d => new LibraryItemResponse
            {
                Id = d.Id,
                ProjectId = d.ProjectId,
                FolderId = d.FolderId,
                Type = TypeName(d.Type),
                Title = d.Title,
                CreatedBy = d.CreatedBy,
                CreatedAt = d.CreatedAt,
                UpdatedAt = d.UpdatedAt
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("project/{projectId}/contents")]
    [EndpointName("GetFolderContents")]
    public async Task<ActionResult<FolderContentsResponse>> GetFolderContents(int projectId, [FromQuery] int? folderId)
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

        // Папок в проекте обычно немного — грузим все для построения дочернего списка и пути.
        var allFolders = await _context.LibraryFolders
            .Where(f => f.ProjectId == projectId)
            .Select(f => new { f.Id, f.ParentFolderId, f.Name, f.CreatedAt, f.UpdatedAt })
            .ToListAsync();

        if (folderId.HasValue && allFolders.All(f => f.Id != folderId.Value))
        {
            return NotFound();
        }

        var folders = allFolders
            .Where(f => f.ParentFolderId == folderId)
            .OrderBy(f => f.Name)
            .Select(f => new FolderResponse
            {
                Id = f.Id,
                ProjectId = projectId,
                ParentFolderId = f.ParentFolderId,
                Name = f.Name,
                CreatedAt = f.CreatedAt,
                UpdatedAt = f.UpdatedAt
            })
            .ToList();

        // Элементы — только непосредственно в этой папке (основной объём фильтруется на сервере).
        // Сравнение с null выносим явно, чтобы EF гарантированно сгенерировал IS NULL для корня.
        var itemsQuery = _context.LibraryItems.Where(d => d.ProjectId == projectId);
        itemsQuery = folderId.HasValue
            ? itemsQuery.Where(d => d.FolderId == folderId.Value)
            : itemsQuery.Where(d => d.FolderId == null);

        var items = await itemsQuery
            .OrderBy(d => d.Title)
            .Select(d => new LibraryItemResponse
            {
                Id = d.Id,
                ProjectId = d.ProjectId,
                FolderId = d.FolderId,
                Type = TypeName(d.Type),
                Title = d.Title,
                CreatedBy = d.CreatedBy,
                CreatedAt = d.CreatedAt,
                UpdatedAt = d.UpdatedAt
            })
            .ToListAsync();

        // Путь от корня к текущей папке.
        var byId = allFolders.ToDictionary(f => f.Id);
        var path = new List<BreadcrumbItem>();
        var cursor = folderId;
        while (cursor.HasValue && byId.TryGetValue(cursor.Value, out var node))
        {
            path.Insert(0, new BreadcrumbItem { Id = node.Id, Name = node.Name });
            cursor = node.ParentFolderId;
        }

        return Ok(new FolderContentsResponse
        {
            FolderId = folderId,
            FolderName = folderId.HasValue && byId.TryGetValue(folderId.Value, out var current) ? current.Name : null,
            Path = path,
            Folders = folders,
            Items = items
        });
    }

    [HttpGet("project/{projectId}/search")]
    [EndpointName("SearchLibrary")]
    public async Task<ActionResult<LibrarySearchResponse>> SearchLibrary(int projectId, [FromQuery] string query)
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

        var term = (query ?? string.Empty).Trim();
        if (term.Length == 0)
        {
            return Ok(new LibrarySearchResponse());
        }

        var pattern = SearchPattern.Contains(term);

        var folders = await _context.LibraryFolders
            .Where(f => f.ProjectId == projectId && EF.Functions.ILike(f.Name, pattern, SearchPattern.EscapeChar))
            .OrderBy(f => f.Name)
            .Take(50)
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

        var items = await _context.LibraryItems
            .Where(d => d.ProjectId == projectId && EF.Functions.ILike(d.Title, pattern, SearchPattern.EscapeChar))
            .OrderBy(d => d.Title)
            .Take(50)
            .Select(d => new LibraryItemResponse
            {
                Id = d.Id,
                ProjectId = d.ProjectId,
                FolderId = d.FolderId,
                Type = TypeName(d.Type),
                Title = d.Title,
                CreatedBy = d.CreatedBy,
                CreatedAt = d.CreatedAt,
                UpdatedAt = d.UpdatedAt
            })
            .ToListAsync();

        return Ok(new LibrarySearchResponse { Folders = folders, Items = items });
    }

    [HttpGet("items/{id}")]
    [EndpointName("GetItem")]
    public async Task<ActionResult<LibraryItemResponse>> GetItem(int id)
    {
        var item = await _context.LibraryItems
            .Include(d => d.Project)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (item == null)
        {
            return NotFound();
        }

        var rights = await _libraryAccess.GetRightsAsync(User, item);
        if (!rights.CanView)
        {
            return Forbid();
        }

        return Ok(ToItemResponse(item));
    }

    [HttpPut("items/{id}")]
    [EndpointName("UpdateItem")]
    public async Task<IActionResult> UpdateItem(int id, UpdateItemRequest request)
    {
        var item = await _context.LibraryItems
            .Include(d => d.Project)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (item == null)
        {
            return NotFound();
        }

        var rights = await _libraryAccess.GetRightsAsync(User, item);
        if (!rights.CanManage)
        {
            return Forbid();
        }

        // Только переименование. Перемещение — отдельный эндпоинт MoveItem.
        item.Title = request.Title;
        item.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPut("items/{id}/move")]
    [EndpointName("MoveItem")]
    public async Task<IActionResult> MoveItem(int id, MoveItemRequest request)
    {
        var item = await _context.LibraryItems
            .Include(d => d.Project)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (item == null)
        {
            return NotFound();
        }

        var rights = await _libraryAccess.GetRightsAsync(User, item);
        if (!rights.CanManage)
        {
            return Forbid();
        }

        if (request.FolderId.HasValue)
        {
            var folder = await _context.LibraryFolders.FindAsync(request.FolderId.Value);
            if (folder == null || folder.ProjectId != item.ProjectId)
            {
                return BadRequest(new { message = "Folder not found or doesn't belong to this project" });
            }
        }

        item.FolderId = request.FolderId;
        item.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("items/{id}")]
    [EndpointName("DeleteItem")]
    public async Task<IActionResult> DeleteItem(int id)
    {
        var item = await _context.LibraryItems
            .Include(d => d.Project)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (item == null)
        {
            return NotFound();
        }

        var rights = await _libraryAccess.GetRightsAsync(User, item);
        if (!rights.CanManage)
        {
            return Forbid();
        }

        _context.LibraryItems.Remove(item);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    #endregion

    #region Documents (тип-специфичный контент)

    [HttpPost("documents")]
    [EndpointName("CreateDocument")]
    public async Task<ActionResult<LibraryItemResponse>> CreateDocument(CreateDocumentRequest request)
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
            var folder = await _context.LibraryFolders.FindAsync(request.FolderId.Value);
            if (folder == null || folder.ProjectId != request.ProjectId)
            {
                return BadRequest(new { message = "Folder not found or doesn't belong to this project" });
            }
        }

        var userId = GetCurrentUserId();

        var item = new LibraryItem
        {
            ProjectId = request.ProjectId,
            FolderId = request.FolderId,
            Type = LibraryItemType.Document,
            Title = request.Title,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            // Пустой контент документа и полные права создателю — одной атомарной транзакцией.
            DocumentContent = new DocumentContent { YjsState = null },
            Permissions =
            {
                new LibraryPermission
                {
                    UserId = userId,
                    CanView = true,
                    CanEdit = true,
                    CanManage = true,
                    GrantedAt = DateTime.UtcNow
                }
            }
        };

        _context.LibraryItems.Add(item);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetItem), new { id = item.Id }, ToItemResponse(item));
    }

    [HttpGet("documents/{id}/content")]
    [EndpointName("GetDocumentContent")]
    public async Task<ActionResult<byte[]>> GetDocumentContent(int id)
    {
        var item = await _context.LibraryItems
            .Include(d => d.Project)
            .Include(d => d.DocumentContent)
            .FirstOrDefaultAsync(d => d.Id == id && d.Type == LibraryItemType.Document);

        if (item == null)
        {
            return NotFound();
        }

        var rights = await _libraryAccess.GetRightsAsync(User, item);
        if (!rights.CanView)
        {
            return Forbid();
        }

        return Ok(item.DocumentContent?.YjsState ?? Array.Empty<byte>());
    }

    [HttpPut("documents/{id}/state")]
    [EndpointName("UpdateDocumentState")]
    public async Task<IActionResult> UpdateDocumentState(int id, [FromBody] byte[] state)
    {
        var item = await _context.LibraryItems
            .Include(d => d.Project)
            .Include(d => d.DocumentContent)
            .FirstOrDefaultAsync(d => d.Id == id && d.Type == LibraryItemType.Document);

        if (item == null)
        {
            return NotFound();
        }

        var rights = await _libraryAccess.GetRightsAsync(User, item);
        if (!rights.CanEdit)
        {
            return Forbid();
        }

        if (item.DocumentContent == null)
        {
            item.DocumentContent = new DocumentContent { LibraryItemId = item.Id };
            _context.DocumentContents.Add(item.DocumentContent);
        }

        item.DocumentContent.YjsState = state;
        item.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return NoContent();
    }
    #endregion

    #region Boards (тип-специфичный контент)

    [HttpPost("boards")]
    [EndpointName("CreateBoard")]
    public async Task<ActionResult<LibraryItemResponse>> CreateBoard(CreateDocumentRequest request)
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
            var folder = await _context.LibraryFolders.FindAsync(request.FolderId.Value);
            if (folder == null || folder.ProjectId != request.ProjectId)
            {
                return BadRequest(new { message = "Folder not found or doesn't belong to this project" });
            }
        }

        var userId = GetCurrentUserId();

        var item = new LibraryItem
        {
            ProjectId = request.ProjectId,
            FolderId = request.FolderId,
            Type = LibraryItemType.Board,
            Title = request.Title,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            BoardContent = new BoardContent { YjsState = null },
            Permissions =
            {
                new LibraryPermission
                {
                    UserId = userId,
                    CanView = true,
                    CanEdit = true,
                    CanManage = true,
                    GrantedAt = DateTime.UtcNow
                }
            }
        };

        _context.LibraryItems.Add(item);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetItem), new { id = item.Id }, ToItemResponse(item));
    }

    [HttpGet("boards/{id}/content")]
    [EndpointName("GetBoardContent")]
    public async Task<ActionResult<byte[]>> GetBoardContent(int id)
    {
        var item = await _context.LibraryItems
            .Include(d => d.Project)
            .Include(d => d.BoardContent)
            .FirstOrDefaultAsync(d => d.Id == id && d.Type == LibraryItemType.Board);

        if (item == null)
        {
            return NotFound();
        }

        var rights = await _libraryAccess.GetRightsAsync(User, item);
        if (!rights.CanView)
        {
            return Forbid();
        }

        return Ok(item.BoardContent?.YjsState ?? Array.Empty<byte>());
    }

    [HttpPut("boards/{id}/state")]
    [EndpointName("UpdateBoardState")]
    public async Task<IActionResult> UpdateBoardState(int id, [FromBody] byte[] state)
    {
        var item = await _context.LibraryItems
            .Include(d => d.Project)
            .Include(d => d.BoardContent)
            .FirstOrDefaultAsync(d => d.Id == id && d.Type == LibraryItemType.Board);

        if (item == null)
        {
            return NotFound();
        }

        var rights = await _libraryAccess.GetRightsAsync(User, item);
        if (!rights.CanEdit)
        {
            return Forbid();
        }

        if (item.BoardContent == null)
        {
            item.BoardContent = new BoardContent { LibraryItemId = item.Id };
            _context.BoardContents.Add(item.BoardContent);
        }

        item.BoardContent.YjsState = state;
        item.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return NoContent();
    }
    #endregion

    #region Permissions

    [HttpGet("items/{id}/permissions")]
    [EndpointName("GetItemPermissions")]
    public async Task<ActionResult<IEnumerable<PermissionResponse>>> GetItemPermissions(int id)
    {
        var item = await _context.LibraryItems
            .Include(d => d.Project)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (item == null)
        {
            return NotFound();
        }

        var rights = await _libraryAccess.GetRightsAsync(User, item);
        if (!rights.CanManage)
        {
            return Forbid();
        }

        var permissions = await _context.LibraryPermissions
            .Where(p => p.LibraryItemId == id)
            .Include(p => p.User)
            .Select(p => new PermissionResponse
            {
                Id = p.Id,
                LibraryItemId = p.LibraryItemId,
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

    [HttpPost("items/{id}/permissions")]
    [EndpointName("SetItemPermission")]
    public async Task<ActionResult<PermissionResponse>> SetItemPermission(int id, SetPermissionRequest request)
    {
        var item = await _context.LibraryItems
            .Include(d => d.Project)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (item == null)
        {
            return NotFound();
        }

        var rights = await _libraryAccess.GetRightsAsync(User, item);
        if (!rights.CanManage)
        {
            return Forbid();
        }

        var user = await _userManager.FindByIdAsync(request.UserId);
        if (user == null)
        {
            return BadRequest(new { message = "User not found" });
        }

        var permission = await _context.LibraryPermissions
            .FirstOrDefaultAsync(p => p.LibraryItemId == id && p.UserId == request.UserId);

        if (permission == null)
        {
            permission = new LibraryPermission
            {
                LibraryItemId = id,
                UserId = request.UserId
            };
            _context.LibraryPermissions.Add(permission);
        }

        permission.CanView = request.CanView;
        permission.CanEdit = request.CanEdit;
        permission.CanManage = request.CanManage;
        permission.GrantedAt = DateTime.UtcNow;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Параллельный запрос успел создать права с тем же (LibraryItemId, UserId)
            // — упёрлись в уникальный индекс. Перечитываем актуальную запись и применяем значения к ней.
            _context.Entry(permission).State = EntityState.Detached;

            permission = await _context.LibraryPermissions
                .FirstAsync(p => p.LibraryItemId == id && p.UserId == request.UserId);

            permission.CanView = request.CanView;
            permission.CanEdit = request.CanEdit;
            permission.CanManage = request.CanManage;
            permission.GrantedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
        }

        var updatedPermission = await _context.LibraryPermissions
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.LibraryItemId == id && p.UserId == request.UserId);

        return Ok(new PermissionResponse
        {
            Id = updatedPermission!.Id,
            LibraryItemId = updatedPermission.LibraryItemId,
            UserId = updatedPermission.UserId,
            UserEmail = updatedPermission.User.Email ?? "",
            CanView = updatedPermission.CanView,
            CanEdit = updatedPermission.CanEdit,
            CanManage = updatedPermission.CanManage,
            GrantedAt = updatedPermission.GrantedAt
        });
    }

    [HttpDelete("items/{id}/permissions/{userId}")]
    [EndpointName("RemoveItemPermission")]
    public async Task<IActionResult> RemoveItemPermission(int id, string userId)
    {
        var item = await _context.LibraryItems
            .Include(d => d.Project)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (item == null)
        {
            return NotFound();
        }

        var rights = await _libraryAccess.GetRightsAsync(User, item);
        if (!rights.CanManage)
        {
            return Forbid();
        }

        var permission = await _context.LibraryPermissions
            .FirstOrDefaultAsync(p => p.LibraryItemId == id && p.UserId == userId);

        if (permission == null)
        {
            return NotFound();
        }

        _context.LibraryPermissions.Remove(permission);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    #endregion
}
