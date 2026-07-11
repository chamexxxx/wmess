using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Data;
using WMess.Api.Enums;
using WMess.Api.Hubs;
using WMess.Api.Models;
using WMess.Api.Models.DTO.Chats;
using WMess.Api.Services;

namespace WMess.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class ChatsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IChatAccessService _chatAccess;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly ITranscriptionService _transcription;
    private readonly ITaskResolver _taskResolver;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<ChatsController> _logger;

    private const long MaxAttachmentSize = 50 * 1024 * 1024;

    public ChatsController(
        ApplicationDbContext context,
        IChatAccessService chatAccess,
        IHubContext<ChatHub> hubContext,
        ITranscriptionService transcription,
        ITaskResolver taskResolver,
        IServiceScopeFactory scopeFactory,
        IWebHostEnvironment env,
        ILogger<ChatsController> logger)
    {
        _context = context;
        _chatAccess = chatAccess;
        _hubContext = hubContext;
        _transcription = transcription;
        _taskResolver = taskResolver;
        _scopeFactory = scopeFactory;
        _env = env;
        _logger = logger;
    }

    private string GetCurrentUserId()
    {
        return User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("User ID not found in token");
    }

    private static string GroupName(int chatId) => ChatHub.GroupName(chatId);

    private string UploadsDir => Path.Combine(_env.ContentRootPath, "uploads");

    private async Task<(Chat? Chat, ChatRights Rights, ActionResult? Error)> EnsureAccessAsync(int chatId, bool requireManage = false)
    {
        var chat = await _chatAccess.LoadChatForAccessAsync(chatId);
        if (chat == null)
        {
            return (null, default, NotFound());
        }

        var rights = await _chatAccess.GetRightsAsync(User, chat);
        if (!rights.CanAccess || (requireManage && !rights.CanManage))
        {
            return (chat, rights, Forbid());
        }

        return (chat, rights, null);
    }

    private static bool HasTextContent(string? content) =>
        !string.IsNullOrWhiteSpace(content);

    // Подтягивает превью последнего сообщения для списка чатов (одним запросом на все чаты).
    private async Task AttachLastMessagesAsync(List<ChatResponse> chats)
    {
        if (chats.Count == 0) return;

        var chatIds = chats.Select(c => c.Id).ToList();
        var lasts = await _context.Chats
            .Where(c => chatIds.Contains(c.Id))
            .Select(c => new
            {
                ChatId = c.Id,
                Last = c.Messages
                    .OrderByDescending(m => m.CreatedAt)
                    .Select(m => new
                    {
                        m.Content,
                        m.CreatedAt,
                        AuthorName = m.Author!.DisplayName,
                        AuthorEmail = m.Author!.Email,
                        IsCall = m.CallRoomId != null,
                        HasAudio = m.Attachments.Any(a => a.ContentType.StartsWith("audio/")),
                        HasAttachment = m.Attachments.Any()
                    })
                    .FirstOrDefault()
            })
            .ToListAsync();

        var byChat = lasts
            .Where(x => x.Last != null)
            .ToDictionary(x => x.ChatId, x => x.Last!);

        foreach (var c in chats)
        {
            if (!byChat.TryGetValue(c.Id, out var last)) continue;
            c.LastMessageAt = last.CreatedAt;
            c.LastMessageAuthor = BuildAuthorName(last.AuthorName, last.AuthorEmail);
            c.LastMessagePreview = BuildMessagePreview(
                last.Content, last.IsCall, last.HasAudio, last.HasAttachment);
        }
    }

    private static string BuildAuthorName(string? displayName, string? email)
    {
        var trimmed = displayName?.Trim();
        if (!string.IsNullOrEmpty(trimmed)) return trimmed;
        if (!string.IsNullOrEmpty(email)) return email.Split('@')[0];
        return "Пользователь";
    }

    private static string BuildMessagePreview(string? content, bool isCall, bool hasAudio, bool hasAttachment)
    {
        if (HasTextContent(content))
        {
            var text = content!.Trim();
            return text.Length > 80 ? text[..80] + "…" : text;
        }
        if (isCall) return "📞 Звонок";
        if (hasAudio) return "🎤 Голосовое сообщение";
        if (hasAttachment) return "📎 Вложение";
        return "";
    }

    private async Task<MessageResponse> MapMessageAsync(Message m)
    {
        var inline = await _taskResolver.ResolveAsync(m.Content);
        return new MessageResponse
        {
            Id = m.Id,
            ChatId = m.ChatId,
            AuthorId = m.AuthorId,
            AuthorEmail = m.Author?.Email,
            AuthorName = m.Author?.DisplayName,
            AuthorHasAvatar = m.Author?.AvatarData != null,
            Content = m.Content,
            ParentMessageId = m.ParentMessageId,
            ReplyMode = m.ReplyMode,
            CreatedAt = m.CreatedAt,
            EditedAt = m.EditedAt,
            Transcription = m.Transcription,
            WaveformData = m.WaveformData,
            CallRoomId = m.CallRoomId,
            CallType = m.CallType,
            Attachments = m.Attachments.Select(a => new AttachmentResponse
            {
                Id = a.Id,
                MessageId = a.MessageId,
                FileName = a.FileName,
                ContentType = a.ContentType,
                Size = a.Size
            }).ToList(),
            Reactions = m.Reactions.Select(r => new ReactionResponse
            {
                Id = r.Id,
                MessageId = r.MessageId,
                UserId = r.UserId,
                Emoji = r.Emoji,
                CreatedAt = r.CreatedAt
            }).ToList(),
            InlineEntities = inline.Select(e => new InlineEntityResponse
            {
                Type = e.Type,
                Id = e.Id,
                Title = e.Title,
                Preview = e.Preview
            }).ToList()
        };
    }

    private async Task LoadMessageGraphAsync(Message message)
    {
        await _context.Entry(message).Reference(m => m.Author).LoadAsync();
        await _context.Entry(message).Collection(m => m.Attachments).LoadAsync();
        await _context.Entry(message).Collection(m => m.Reactions).LoadAsync();
    }

    private async Task BroadcastMessageUpdatedAsync(int chatId, Message message)
    {
        await LoadMessageGraphAsync(message);
        var response = await MapMessageAsync(message);
        await _hubContext.Clients.Group(GroupName(chatId))
            .SendAsync("MessageUpdated", response);
    }

    private void DeleteFilesOnDisk(IEnumerable<Attachment> attachments)
    {
        foreach (var a in attachments)
        {
            var path = Path.Combine(UploadsDir, a.StoredName);
            if (System.IO.File.Exists(path))
            {
                try { System.IO.File.Delete(path); }
                catch (Exception ex) { _logger.LogWarning(ex, "Failed to delete attachment file {Path}", path); }
            }
        }
    }

    private async Task<int> GetMessageDepthAsync(Message message)
    {
        var depth = 0;
        var cursor = message;
        while (cursor != null)
        {
            depth++;
            if (!cursor.ParentMessageId.HasValue) break;
            cursor = await _context.Messages.AsNoTracking()
                .FirstOrDefaultAsync(m => m.Id == cursor.ParentMessageId.Value);
        }
        return depth;
    }

    private async Task<bool> IsInThreadContextAsync(int chatId, int parentMessageId)
    {
        var cursor = await _context.Messages.AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == parentMessageId && m.ChatId == chatId);
        while (cursor != null)
        {
            if (cursor.ReplyMode == ReplyMode.Thread) return true;
            if (!cursor.ParentMessageId.HasValue) return false;
            cursor = await _context.Messages.AsNoTracking()
                .FirstOrDefaultAsync(m => m.Id == cursor.ParentMessageId.Value && m.ChatId == chatId);
        }
        return false;
    }

    private async Task<List<Message>> LoadThreadMessagesAsync(int chatId, int rootId, int? before, int limit)
    {
        var threadIds = new HashSet<int> { rootId };
        var all = new List<Message>();

        var direct = await _context.Messages
            .Where(m => m.ChatId == chatId && m.ParentMessageId == rootId && m.ReplyMode == ReplyMode.Thread)
            .Include(m => m.Author)
            .Include(m => m.Attachments)
            .Include(m => m.Reactions)
            .ToListAsync();
        foreach (var m in direct)
        {
            all.Add(m);
            threadIds.Add(m.Id);
        }

        var added = true;
        while (added)
        {
            added = false;
            var flats = await _context.Messages
                .Where(m => m.ChatId == chatId
                    && m.ReplyMode == ReplyMode.Flat
                    && m.ParentMessageId != null
                    && threadIds.Contains(m.ParentMessageId.Value))
                .Include(m => m.Author)
                .Include(m => m.Attachments)
                .Include(m => m.Reactions)
                .ToListAsync();
            foreach (var m in flats)
            {
                if (threadIds.Add(m.Id))
                {
                    all.Add(m);
                    added = true;
                }
            }
        }

        IEnumerable<Message> ordered = all.OrderByDescending(m => m.CreatedAt);
        if (before.HasValue) ordered = ordered.Where(m => m.Id < before.Value);
        return ordered.Take(limit).Reverse().ToList();
    }

    private async Task<(int? ResolvedParentId, ActionResult? Error)> ResolveParentAsync(
        int chatId,
        Chat chat,
        int parentMessageId,
        ReplyMode? replyMode)
    {
        var parent = await _context.Messages.AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == parentMessageId);

        if (parent == null || parent.ChatId != chatId)
        {
            return (null, BadRequest(new { message = "Родительское сообщение не найдено или не принадлежит этому чату" }));
        }

        var parentDepth = await GetMessageDepthAsync(parent);
        var mode = replyMode ?? ReplyMode.Flat;

        if (parentDepth == 1)
        {
            if (mode == ReplyMode.Thread)
            {
                return (parent.Id, null);
            }
            return (parent.Id, null);
        }

        if (mode == ReplyMode.Thread)
        {
            return (null, BadRequest(new { message = "Тред доступен только для ответа на корневое сообщение" }));
        }

        if (chat.MaxNestingLevel > 0)
        {
            var newDepth = parentDepth + 1;
            if (newDepth > chat.MaxNestingLevel)
            {
                return (null, BadRequest(new { message = $"Превышена максимальная глубина вложенности ({chat.MaxNestingLevel})" }));
            }
        }

        return (parent.Id, null);
    }

    private async Task<(List<Attachment>? Attachments, ActionResult? Error)> SaveAttachmentsAsync(
        int messageId,
        IReadOnlyList<IFormFile> files)
    {
        var saved = new List<Attachment>();
        Directory.CreateDirectory(UploadsDir);

        foreach (var file in files)
        {
            if (file.Length == 0 || file.Length > MaxAttachmentSize)
            {
                return (null, BadRequest(new { message = $"Размер файла должен быть от 1 байта до {MaxAttachmentSize / 1024 / 1024} MB" }));
            }

            var storedName = $"{Guid.NewGuid():N}_{Path.GetFileName(file.FileName)}";
            var filePath = Path.Combine(UploadsDir, storedName);
            await using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var attachment = new Attachment
            {
                MessageId = messageId,
                FileName = file.FileName,
                StoredName = storedName,
                ContentType = file.ContentType,
                Size = file.Length
            };
            _context.Attachments.Add(attachment);
            saved.Add(attachment);

            if (file.ContentType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase))
            {
                QueueTranscription(messageId, storedName, file.ContentType);
            }
        }

        return (saved, null);
    }

    private void QueueTranscription(int messageId, string storedName, string contentType)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var transcription = scope.ServiceProvider.GetRequiredService<ITranscriptionService>();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var hub = scope.ServiceProvider.GetRequiredService<IHubContext<ChatHub>>();

                var text = await transcription.TranscribeAsync(storedName, contentType);
                if (text == null) return;

                var msg = await db.Messages
                    .Include(m => m.Author)
                    .Include(m => m.Attachments)
                    .Include(m => m.Reactions)
                    .FirstOrDefaultAsync(m => m.Id == messageId);
                if (msg == null) return;

                msg.Transcription = text;
                await db.SaveChangesAsync();

                var resolver = scope.ServiceProvider.GetRequiredService<ITaskResolver>();
                var inline = await resolver.ResolveAsync(msg.Content);
                var response = new MessageResponse
                {
                    Id = msg.Id,
                    ChatId = msg.ChatId,
                    AuthorId = msg.AuthorId,
                    AuthorEmail = msg.Author?.Email,
                    AuthorName = msg.Author?.DisplayName,
                    AuthorHasAvatar = msg.Author?.AvatarData != null,
                    Content = msg.Content,
                    ParentMessageId = msg.ParentMessageId,
                    ReplyMode = msg.ReplyMode,
                    CreatedAt = msg.CreatedAt,
                    EditedAt = msg.EditedAt,
                    Transcription = msg.Transcription,
                    WaveformData = msg.WaveformData,
                    CallRoomId = msg.CallRoomId,
                    CallType = msg.CallType,
                    Attachments = msg.Attachments.Select(a => new AttachmentResponse
                    {
                        Id = a.Id, MessageId = a.MessageId, FileName = a.FileName,
                        ContentType = a.ContentType, Size = a.Size
                    }).ToList(),
                    Reactions = msg.Reactions.Select(r => new ReactionResponse
                    {
                        Id = r.Id, MessageId = r.MessageId, UserId = r.UserId,
                        Emoji = r.Emoji, CreatedAt = r.CreatedAt
                    }).ToList(),
                    InlineEntities = inline.Select(e => new InlineEntityResponse
                    {
                        Type = e.Type, Id = e.Id, Title = e.Title, Preview = e.Preview
                    }).ToList()
                };
                await hub.Clients.Group(GroupName(msg.ChatId)).SendAsync("MessageUpdated", response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Transcription failed for message {MessageId}", messageId);
            }
        });
    }

    // ===== Чаты =====

    [HttpGet("project/{projectId}")]
    [EndpointName("GetProjectChats")]
    public async Task<ActionResult<IEnumerable<ChatResponse>>> GetProjectChats(int projectId)
    {
        var project = await _context.Projects.FindAsync(projectId);
        if (project == null) return NotFound();

        var probe = new Chat { Type = ChatType.Project, Project = project };
        var rights = await _chatAccess.GetRightsAsync(User, probe);
        if (!rights.CanAccess) return Forbid();

        var chats = await _context.Chats
            .Where(c => c.ProjectId == projectId)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new ChatResponse
            {
                Id = c.Id, Name = c.Name, Type = c.Type, TeamId = c.TeamId,
                ProjectId = c.ProjectId, MaxNestingLevel = c.MaxNestingLevel, CreatedAt = c.CreatedAt
            })
            .ToListAsync();

        foreach (var c in chats) c.CanManage = rights.CanManage;
        await AttachLastMessagesAsync(chats);
        return Ok(chats);
    }

    [HttpGet("team/{teamId}")]
    [EndpointName("GetTeamChats")]
    public async Task<ActionResult<IEnumerable<ChatResponse>>> GetTeamChats(int teamId)
    {
        var team = await _context.Teams.FindAsync(teamId);
        if (team == null) return NotFound();

        var probe = new Chat { Type = ChatType.Team, Team = team };
        var rights = await _chatAccess.GetRightsAsync(User, probe);
        if (!rights.CanAccess) return Forbid();

        var chats = await _context.Chats
            .Where(c => c.TeamId == teamId)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new ChatResponse
            {
                Id = c.Id, Name = c.Name, Type = c.Type, TeamId = c.TeamId,
                ProjectId = c.ProjectId, MaxNestingLevel = c.MaxNestingLevel, CreatedAt = c.CreatedAt
            })
            .ToListAsync();

        foreach (var c in chats) c.CanManage = rights.CanManage;
        await AttachLastMessagesAsync(chats);
        return Ok(chats);
    }

    [HttpGet("{id}")]
    [EndpointName("GetChat")]
    public async Task<ActionResult<ChatResponse>> GetChat(int id)
    {
        var (chat, rights, error) = await EnsureAccessAsync(id);
        if (error != null) return error;

        return Ok(new ChatResponse
        {
            Id = chat!.Id, Name = chat.Name, Type = chat.Type, TeamId = chat.TeamId,
            ProjectId = chat.ProjectId, MaxNestingLevel = chat.MaxNestingLevel,
            CreatedAt = chat.CreatedAt, CanManage = rights.CanManage
        });
    }

    [HttpPost]
    [EndpointName("CreateChat")]
    public async Task<ActionResult<ChatResponse>> CreateChat(CreateChatRequest request)
    {
        if (request.TeamId != null && request.ProjectId != null)
        {
            return BadRequest(new { message = "Укажите только TeamId или ProjectId" });
        }
        if (request.TeamId == null && request.ProjectId == null)
        {
            return BadRequest(new { message = "Укажите TeamId или ProjectId" });
        }

        ChatType type;
        Chat chatEntity;

        if (request.ProjectId != null)
        {
            var project = await _context.Projects.FindAsync(request.ProjectId.Value);
            if (project == null) return BadRequest(new { message = "Project not found" });
            chatEntity = new Chat { Type = ChatType.Project, Project = project };
            type = ChatType.Project;
        }
        else
        {
            var team = await _context.Teams.FindAsync(request.TeamId!.Value);
            if (team == null) return BadRequest(new { message = "Team not found" });
            chatEntity = new Chat { Type = ChatType.Team, Team = team };
            type = ChatType.Team;
        }

        var rights = await _chatAccess.GetRightsAsync(User, chatEntity);
        if (!rights.CanAccess) return Forbid();

        var chat = new Chat
        {
            Name = request.Name,
            Type = type,
            TeamId = type == ChatType.Team ? request.TeamId : null,
            ProjectId = type == ChatType.Project ? request.ProjectId : null,
            MaxNestingLevel = request.MaxNestingLevel,
            CreatedAt = DateTime.UtcNow
        };

        _context.Chats.Add(chat);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetChat), new { id = chat.Id }, new ChatResponse
        {
            Id = chat.Id, Name = chat.Name, Type = chat.Type, TeamId = chat.TeamId,
            ProjectId = chat.ProjectId, MaxNestingLevel = chat.MaxNestingLevel,
            CreatedAt = chat.CreatedAt, CanManage = rights.CanManage
        });
    }

    [HttpPost("direct")]
    [EndpointName("CreateDirectChat")]
    public async Task<ActionResult<ChatResponse>> CreateDirectChat(CreateDirectChatRequest request)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrWhiteSpace(request.TargetUserId) || request.TargetUserId == userId)
        {
            return BadRequest(new { message = "Укажите другого пользователя" });
        }

        var target = await _context.Users.FindAsync(request.TargetUserId);
        if (target == null) return BadRequest(new { message = "Пользователь не найден" });

        var existing = await _context.Chats
            .Where(c => c.Type == ChatType.Direct)
            .Where(c => c.Members.Any(m => m.UserId == userId))
            .Where(c => c.Members.Any(m => m.UserId == request.TargetUserId))
            .FirstOrDefaultAsync();

        if (existing != null)
        {
            return Ok(new ChatResponse
            {
                Id = existing.Id, Name = existing.Name, Type = existing.Type,
                MaxNestingLevel = existing.MaxNestingLevel, CreatedAt = existing.CreatedAt,
                CanManage = false
            });
        }

        var chat = new Chat
        {
            Type = ChatType.Direct,
            Name = null,
            CreatedAt = DateTime.UtcNow
        };
        _context.Chats.Add(chat);
        await _context.SaveChangesAsync();

        _context.ChatMembers.AddRange(
            new ChatMember { ChatId = chat.Id, UserId = userId, JoinedAt = DateTime.UtcNow },
            new ChatMember { ChatId = chat.Id, UserId = request.TargetUserId, JoinedAt = DateTime.UtcNow }
        );
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetChat), new { id = chat.Id }, new ChatResponse
        {
            Id = chat.Id, Name = chat.Name, Type = chat.Type,
            MaxNestingLevel = chat.MaxNestingLevel, CreatedAt = chat.CreatedAt, CanManage = false
        });
    }

    [HttpDelete("{id}")]
    [EndpointName("DeleteChat")]
    public async Task<IActionResult> DeleteChat(int id)
    {
        var (chat, rights, error) = await EnsureAccessAsync(id, requireManage: true);
        if (error != null) return error;

        var attachments = await _context.Attachments
            .Where(a => a.Message.ChatId == id)
            .ToListAsync();
        DeleteFilesOnDisk(attachments);

        _context.Chats.Remove(chat!);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id}/read")]
    [EndpointName("MarkChatRead")]
    public async Task<IActionResult> MarkChatRead(int id)
    {
        var (_, _, error) = await EnsureAccessAsync(id);
        if (error != null) return error;

        var userId = GetCurrentUserId();
        var member = await _context.ChatMembers
            .FirstOrDefaultAsync(cm => cm.ChatId == id && cm.UserId == userId);

        if (member == null)
        {
            member = new ChatMember { ChatId = id, UserId = userId, JoinedAt = DateTime.UtcNow };
            _context.ChatMembers.Add(member);
        }

        member.LastReadAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // ===== Сообщения =====

    [HttpGet("{id}/messages")]
    [EndpointName("GetMessages")]
    public async Task<ActionResult<IEnumerable<MessageResponse>>> GetMessages(
        int id,
        [FromQuery] int? before,
        [FromQuery] int? parentMessageId,
        [FromQuery] int limit = 50)
    {
        var (_, _, error) = await EnsureAccessAsync(id);
        if (error != null) return error;

        limit = Math.Clamp(limit, 1, 100);

        if (parentMessageId.HasValue)
        {
            var threadMessages = await LoadThreadMessagesAsync(id, parentMessageId.Value, before, limit);
            var threadResult = new List<MessageResponse>();
            foreach (var m in threadMessages) threadResult.Add(await MapMessageAsync(m));
            return Ok(threadResult);
        }

        var candidates = await _context.Messages
            .Where(m => m.ChatId == id && (m.ParentMessageId == null || m.ReplyMode == ReplyMode.Flat))
            .Include(m => m.Author)
            .Include(m => m.Attachments)
            .Include(m => m.Reactions)
            .OrderByDescending(m => m.CreatedAt)
            .Take(limit * 3)
            .ToListAsync();

        var filtered = new List<Message>();
        foreach (var m in candidates)
        {
            if (m.ParentMessageId == null || m.ReplyMode != ReplyMode.Flat)
            {
                filtered.Add(m);
                continue;
            }
            if (!await IsInThreadContextAsync(id, m.ParentMessageId.Value))
                filtered.Add(m);
        }

        if (before.HasValue)
            filtered = filtered.Where(m => m.Id < before.Value).ToList();

        var messages = filtered
            .OrderByDescending(m => m.CreatedAt)
            .Take(limit)
            .Reverse()
            .ToList();
        var result = new List<MessageResponse>();
        foreach (var m in messages) result.Add(await MapMessageAsync(m));
        return Ok(result);
    }

    [HttpGet("{id}/messages/{messageId}/thread")]
    [EndpointName("GetThreadInfo")]
    public async Task<ActionResult<ThreadInfoResponse>> GetThreadInfo(int id, int messageId)
    {
        var (_, _, error) = await EnsureAccessAsync(id);
        if (error != null) return error;

        var root = await _context.Messages.AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == messageId && m.ChatId == id);
        if (root == null) return NotFound();

        var replies = await LoadThreadMessagesAsync(id, messageId, null, 1000);

        MessageResponse? last = null;
        if (replies.Count > 0) last = await MapMessageAsync(replies[^1]);

        return Ok(new ThreadInfoResponse
        {
            RootMessageId = messageId,
            ReplyCount = replies.Count,
            LastReply = last
        });
    }

    [HttpPost("{id}/messages")]
    [EndpointName("SendMessage")]
    [Consumes("application/json", "multipart/form-data")]
    public async Task<ActionResult<MessageResponse>> SendMessage(int id)
    {
        var (chat, _, error) = await EnsureAccessAsync(id);
        if (error != null) return error;

        string? content;
        int? parentMessageId;
        ReplyMode? replyMode;
        IReadOnlyList<IFormFile> files = Array.Empty<IFormFile>();

        if (Request.HasFormContentType)
        {
            content = Request.Form["content"].FirstOrDefault();
            var parentRaw = Request.Form["parentMessageId"].FirstOrDefault();
            parentMessageId = int.TryParse(parentRaw, out var p) ? p : null;
            var modeRaw = Request.Form["replyMode"].FirstOrDefault();
            replyMode = Enum.TryParse<ReplyMode>(modeRaw, true, out var mode) ? mode : null;
            files = Request.Form.Files.ToList();
        }
        else
        {
            var request = await Request.ReadFromJsonAsync<SendMessageRequest>();
            if (request == null) return BadRequest();
            content = request.Content;
            parentMessageId = request.ParentMessageId;
            replyMode = request.ReplyMode;
        }

        if (!HasTextContent(content) && files.Count == 0)
        {
            return BadRequest(new { message = "Сообщение должно содержать текст или вложение" });
        }

        int? resolvedParentId = null;
        if (parentMessageId.HasValue)
        {
            var (resolved, parentError) = await ResolveParentAsync(id, chat!, parentMessageId.Value, replyMode);
            if (parentError != null) return parentError;
            resolvedParentId = resolved;
        }

        var userId = GetCurrentUserId();
        var message = new Message
        {
            ChatId = id,
            AuthorId = userId,
            Content = content,
            ParentMessageId = resolvedParentId,
            ReplyMode = resolvedParentId.HasValue ? (replyMode ?? ReplyMode.Flat) : null,
            CreatedAt = DateTime.UtcNow
        };

        _context.Messages.Add(message);
        await _context.SaveChangesAsync();

        if (files.Count > 0)
        {
            var (saved, fileError) = await SaveAttachmentsAsync(message.Id, files);
            if (fileError != null) return fileError;
            await _context.SaveChangesAsync();
            message.Attachments = saved!;
        }

        await LoadMessageGraphAsync(message);
        var response = await MapMessageAsync(message);

        await _hubContext.Clients.Group(GroupName(id)).SendAsync("ReceiveMessage", response);
        return CreatedAtAction(nameof(GetMessages), new { id }, response);
    }

    [HttpPut("{id}/messages/{messageId}")]
    [EndpointName("UpdateMessage")]
    public async Task<IActionResult> UpdateMessage(int id, int messageId, UpdateMessageRequest request)
    {
        var (chat, rights, error) = await EnsureAccessAsync(id);
        if (error != null) return error;

        var message = await _context.Messages
            .Include(m => m.Attachments)
            .FirstOrDefaultAsync(m => m.Id == messageId && m.ChatId == id);
        if (message == null) return NotFound();

        var userId = GetCurrentUserId();
        if (message.AuthorId != userId && !rights.CanManage) return Forbid();

        if (!HasTextContent(request.Content) && message.Attachments.Count == 0)
        {
            return BadRequest(new { message = "Сообщение должно содержать текст или вложение" });
        }

        message.Content = request.Content;
        message.EditedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await BroadcastMessageUpdatedAsync(id, message);
        var response = await MapMessageAsync(message);
        return Ok(response);
    }

    [HttpPatch("{id}/messages/{messageId}/waveform")]
    [EndpointName("UpdateWaveform")]
    public async Task<IActionResult> UpdateWaveform(int id, int messageId, UpdateWaveformRequest request)
    {
        var (_, rights, error) = await EnsureAccessAsync(id);
        if (error != null) return error;

        var message = await _context.Messages.FirstOrDefaultAsync(m => m.Id == messageId && m.ChatId == id);
        if (message == null) return NotFound();

        var userId = GetCurrentUserId();
        if (message.AuthorId != userId && !rights.CanManage) return Forbid();

        message.WaveformData = request.WaveformData;
        await _context.SaveChangesAsync();

        await BroadcastMessageUpdatedAsync(id, message);
        return Ok(await MapMessageAsync(message));
    }

    [HttpDelete("{id}/messages/{messageId}")]
    [EndpointName("DeleteMessage")]
    public async Task<IActionResult> DeleteMessage(int id, int messageId)
    {
        var (_, rights, error) = await EnsureAccessAsync(id);
        if (error != null) return error;

        var message = await _context.Messages
            .Include(m => m.Attachments)
            .FirstOrDefaultAsync(m => m.Id == messageId && m.ChatId == id);
        if (message == null) return NotFound();

        var userId = GetCurrentUserId();
        if (message.AuthorId != userId && !rights.CanManage) return Forbid();

        DeleteFilesOnDisk(message.Attachments);
        _context.Messages.Remove(message);
        await _context.SaveChangesAsync();

        await _hubContext.Clients.Group(GroupName(id))
            .SendAsync("MessageDeleted", id, messageId);
        return NoContent();
    }

    [HttpPost("{id}/messages/{messageId}/transcribe")]
    [EndpointName("TranscribeMessage")]
    public async Task<IActionResult> TranscribeMessage(int id, int messageId)
    {
        var (_, _, error) = await EnsureAccessAsync(id);
        if (error != null) return error;

        var message = await _context.Messages.FirstOrDefaultAsync(m => m.Id == messageId && m.ChatId == id);
        if (message == null) return NotFound();

        return Accepted(new { message = "Transcription queued (stub)" });
    }

    // ===== Созвоны =====

    [HttpPost("{id}/calls")]
    [EndpointName("StartCall")]
    public async Task<ActionResult<MessageResponse>> StartCall(int id, StartCallRequest request)
    {
        var (_, _, error) = await EnsureAccessAsync(id);
        if (error != null) return error;

        var callType = request.CallType?.ToLowerInvariant() is "audio" or "video"
            ? request.CallType.ToLowerInvariant()
            : "video";

        var roomId = $"wmess-{id}-{Guid.NewGuid():N}";
        var userId = GetCurrentUserId();

        var message = new Message
        {
            ChatId = id,
            AuthorId = userId,
            Content = callType == "audio" ? "Начат аудиозвонок" : "Начат видеозвонок",
            CallRoomId = roomId,
            CallType = callType,
            CreatedAt = DateTime.UtcNow
        };

        _context.Messages.Add(message);
        await _context.SaveChangesAsync();
        await LoadMessageGraphAsync(message);

        var response = await MapMessageAsync(message);
        await _hubContext.Clients.Group(GroupName(id)).SendAsync("ReceiveMessage", response);
        return Ok(response);
    }

    // ===== Реакции =====

    [HttpPost("{id}/messages/{messageId}/reactions")]
    [EndpointName("ToggleReaction")]
    public async Task<ActionResult<ReactionResponse>> ToggleReaction(int id, int messageId, ToggleReactionRequest request)
    {
        var (_, _, error) = await EnsureAccessAsync(id);
        if (error != null) return error;

        var message = await _context.Messages.FirstOrDefaultAsync(m => m.Id == messageId && m.ChatId == id);
        if (message == null) return NotFound();

        var userId = GetCurrentUserId();
        var emoji = request.Emoji?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(emoji)) return BadRequest(new { message = "Emoji не указан" });

        var existing = await _context.Reactions
            .FirstOrDefaultAsync(r => r.MessageId == messageId && r.UserId == userId && r.Emoji == emoji);

        bool added;
        ReactionResponse? response = null;

        if (existing != null)
        {
            _context.Reactions.Remove(existing);
            added = false;
        }
        else
        {
            existing = new Reaction
            {
                MessageId = messageId, UserId = userId, Emoji = emoji, CreatedAt = DateTime.UtcNow
            };
            _context.Reactions.Add(existing);
            added = true;
            response = new ReactionResponse
            {
                Id = existing.Id, MessageId = messageId, UserId = userId,
                Emoji = emoji, CreatedAt = existing.CreatedAt
            };
        }

        try { await _context.SaveChangesAsync(); }
        catch (DbUpdateException) { return Ok(new { message = "conflict" }); }

        await _hubContext.Clients.Group(GroupName(id))
            .SendAsync("ReceiveReaction", id, messageId, userId, emoji, added);

        return Ok(response ?? new ReactionResponse { MessageId = messageId, UserId = userId, Emoji = emoji });
    }

    // ===== Закреплённые =====

    [HttpGet("{id}/pinned")]
    [EndpointName("GetPinnedMessages")]
    public async Task<ActionResult<IEnumerable<PinnedMessageResponse>>> GetPinnedMessages(int id)
    {
        var (_, _, error) = await EnsureAccessAsync(id);
        if (error != null) return error;

        var pinned = await _context.PinnedMessages
            .Where(p => p.ChatId == id)
            .Include(p => p.Message).ThenInclude(m => m!.Author)
            .Include(p => p.Message).ThenInclude(m => m!.Attachments)
            .Include(p => p.Message).ThenInclude(m => m!.Reactions)
            .OrderByDescending(p => p.PinnedAt)
            .ToListAsync();

        var result = new List<PinnedMessageResponse>();
        foreach (var p in pinned)
        {
            result.Add(new PinnedMessageResponse
            {
                Id = p.Id, ChatId = p.ChatId, MessageId = p.MessageId,
                PinnedBy = p.PinnedBy, PinnedAt = p.PinnedAt,
                Message = p.Message != null ? await MapMessageAsync(p.Message) : null
            });
        }
        return Ok(result);
    }

    [HttpPost("{id}/messages/{messageId}/pin")]
    [EndpointName("PinMessage")]
    public async Task<IActionResult> PinMessage(int id, int messageId)
    {
        var (_, _, error) = await EnsureAccessAsync(id, requireManage: true);
        if (error != null) return error;

        var message = await _context.Messages.FirstOrDefaultAsync(m => m.Id == messageId && m.ChatId == id);
        if (message == null) return NotFound();

        var userId = GetCurrentUserId();
        var existing = await _context.PinnedMessages
            .FirstOrDefaultAsync(p => p.ChatId == id && p.MessageId == messageId);

        if (existing != null)
        {
            return Ok(new PinnedMessageResponse
            {
                Id = existing.Id, ChatId = existing.ChatId, MessageId = existing.MessageId,
                PinnedBy = existing.PinnedBy, PinnedAt = existing.PinnedAt
            });
        }

        var pin = new PinnedMessage
        {
            ChatId = id, MessageId = messageId, PinnedBy = userId, PinnedAt = DateTime.UtcNow
        };
        _context.PinnedMessages.Add(pin);
        try { await _context.SaveChangesAsync(); }
        catch (DbUpdateException) { return Ok(new { message = "already pinned" }); }

        await _hubContext.Clients.Group(GroupName(id))
            .SendAsync("MessagePinned", id, messageId, userId);

        return Ok(new PinnedMessageResponse
        {
            Id = pin.Id, ChatId = pin.ChatId, MessageId = pin.MessageId,
            PinnedBy = pin.PinnedBy, PinnedAt = pin.PinnedAt
        });
    }

    [HttpDelete("{id}/messages/{messageId}/pin")]
    [EndpointName("UnpinMessage")]
    public async Task<IActionResult> UnpinMessage(int id, int messageId)
    {
        var (_, _, error) = await EnsureAccessAsync(id, requireManage: true);
        if (error != null) return error;

        var pin = await _context.PinnedMessages
            .FirstOrDefaultAsync(p => p.ChatId == id && p.MessageId == messageId);
        if (pin == null) return NotFound();

        _context.PinnedMessages.Remove(pin);
        await _context.SaveChangesAsync();

        await _hubContext.Clients.Group(GroupName(id))
            .SendAsync("MessageUnpinned", id, messageId);
        return NoContent();
    }

    // ===== Вложения =====

    [HttpPost("{id}/messages/{messageId}/attachments")]
    [EndpointName("UploadAttachment")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<AttachmentResponse>> UploadAttachment(int id, int messageId, IFormFile file)
    {
        var (_, rights, error) = await EnsureAccessAsync(id);
        if (error != null) return error;

        var message = await _context.Messages.FirstOrDefaultAsync(m => m.Id == messageId && m.ChatId == id);
        if (message == null) return NotFound();

        var userId = GetCurrentUserId();
        if (message.AuthorId != userId && !rights.CanManage) return Forbid();

        var (saved, fileError) = await SaveAttachmentsAsync(messageId, new[] { file });
        if (fileError != null) return fileError;

        await _context.SaveChangesAsync();
        var attachment = saved![0];

        await BroadcastMessageUpdatedAsync(id, message);

        return Ok(new AttachmentResponse
        {
            Id = attachment.Id, MessageId = attachment.MessageId,
            FileName = attachment.FileName, ContentType = attachment.ContentType, Size = attachment.Size
        });
    }

    [HttpGet("attachments/{attachmentId}")]
    [EndpointName("DownloadAttachment")]
    public async Task<IActionResult> DownloadAttachment(int attachmentId)
    {
        var attachment = await _context.Attachments
            .Include(a => a.Message)
            .FirstOrDefaultAsync(a => a.Id == attachmentId);
        if (attachment == null) return NotFound();

        var (_, _, error) = await EnsureAccessAsync(attachment.Message.ChatId);
        if (error != null) return error;

        var filePath = Path.Combine(UploadsDir, attachment.StoredName);
        if (!System.IO.File.Exists(filePath)) return NotFound();

        var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read);
        var isMedia = attachment.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase)
                      || attachment.ContentType.StartsWith("video/", StringComparison.OrdinalIgnoreCase)
                      || attachment.ContentType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase);

        return isMedia
            ? File(stream, attachment.ContentType)
            : File(stream, attachment.ContentType, attachment.FileName);
    }
}
