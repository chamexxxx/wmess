using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Authorization;
using WMess.Api.Data;
using WMess.Api.Enums;
using WMess.Api.Models;

namespace WMess.Api.Services;

/// <summary>
/// Эффективные права пользователя на чат. Иерархия: manage ⊇ access.
/// </summary>
public readonly record struct ChatRights(bool CanAccess, bool CanManage);

public interface IChatAccessService
{
    /// <summary>
    /// Вычисляет права пользователя на чат. Требует загруженный <see cref="Chat.Team"/> или
    /// <see cref="Chat.Project"/> в зависимости от <see cref="ChatType"/>.
    /// </summary>
    Task<ChatRights> GetRightsAsync(ClaimsPrincipal user, Chat chat, CancellationToken cancellationToken = default);

    /// <summary>
    /// Загружает чат с навигационными свойствами, нужными для проверки прав.
    /// </summary>
    Task<Chat?> LoadChatForAccessAsync(int chatId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Единый источник вычисления прав на чат. Используется и контроллером, и SignalR-хабом.
/// Видимость чата выводится из членства в команде/проекте, а не из таблицы участников.
/// </summary>
public class ChatAccessService : IChatAccessService
{
    private readonly ApplicationDbContext _context;
    private readonly IAuthorizationService _authorizationService;

    public ChatAccessService(ApplicationDbContext context, IAuthorizationService authorizationService)
    {
        _context = context;
        _authorizationService = authorizationService;
    }

    public async Task<Chat?> LoadChatForAccessAsync(int chatId, CancellationToken cancellationToken = default)
    {
        return await _context.Chats
            .AsNoTracking()
            .Include(c => c.Team)
            .Include(c => c.Project)
            .FirstOrDefaultAsync(c => c.Id == chatId, cancellationToken);
    }

    public async Task<ChatRights> GetRightsAsync(ClaimsPrincipal user, Chat chat, CancellationToken cancellationToken = default)
    {
        switch (chat.Type)
        {
            case ChatType.Project:
            {
                if (chat.Project == null)
                {
                    return new ChatRights(false, false);
                }

                var manage = (await _authorizationService.AuthorizeAsync(user, chat.Project, Policies.ProjectManage)).Succeeded;
                var access = manage
                    || (await _authorizationService.AuthorizeAsync(user, chat.Project, Policies.ProjectAccess)).Succeeded;
                return new ChatRights(access, manage);
            }
            case ChatType.Team:
            {
                if (chat.Team == null)
                {
                    return new ChatRights(false, false);
                }

                var manage = (await _authorizationService.AuthorizeAsync(user, chat.Team, Policies.TeamManage)).Succeeded;
                var access = manage
                    || (await _authorizationService.AuthorizeAsync(user, chat.Team, Policies.TeamMember)).Succeeded;
                return new ChatRights(access, manage);
            }
            case ChatType.Direct:
            {
                var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
                if (userId == null)
                {
                    return new ChatRights(false, false);
                }

                var isMember = await _context.ChatMembers
                    .AsNoTracking()
                    .AnyAsync(cm => cm.ChatId == chat.Id && cm.UserId == userId, cancellationToken);
                return new ChatRights(isMember, false);
            }
            default:
                return new ChatRights(false, false);
        }
    }
}
