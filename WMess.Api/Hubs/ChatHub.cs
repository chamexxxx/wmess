using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using WMess.Api.Services;

namespace WMess.Api.Hubs;

/// <summary>
/// Хаб чатов. По ТЗ мутации идут через REST, а хаб — только подписка на группу чата
/// и оповещение о наборе текста (UserTyping). REST рассылает события через IHubContext.
/// </summary>
[Authorize]
public class ChatHub : Hub
{
    private readonly IChatAccessService _chatAccess;
    private readonly ILogger<ChatHub> _logger;

    public ChatHub(IChatAccessService chatAccess, ILogger<ChatHub> logger)
    {
        _chatAccess = chatAccess;
        _logger = logger;
    }

    private string GetCurrentUserId()
    {
        return Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new HubException("User ID not found in token");
    }

    public static string GroupName(int chatId) => $"chat_{chatId}";

    public async Task JoinChat(int chatId)
    {
        var chat = await _chatAccess.LoadChatForAccessAsync(chatId);
        if (chat == null)
        {
            throw new HubException("Chat not found");
        }

        var rights = await _chatAccess.GetRightsAsync(Context.User!, chat);
        if (!rights.CanAccess)
        {
            throw new HubException("Access denied");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(chatId));
        _logger.LogInformation("User {UserId} joined chat {ChatId}", GetCurrentUserId(), chatId);
    }

    public async Task LeaveChat(int chatId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(chatId));
        _logger.LogInformation("User {UserId} left chat {ChatId}", GetCurrentUserId(), chatId);
    }

    public async Task UserTyping(int chatId)
    {
        var chat = await _chatAccess.LoadChatForAccessAsync(chatId);
        if (chat == null)
        {
            return;
        }

        var rights = await _chatAccess.GetRightsAsync(Context.User!, chat);
        if (!rights.CanAccess)
        {
            return;
        }

        var userId = GetCurrentUserId();
        await Clients.OthersInGroup(GroupName(chatId))
            .SendAsync("UserTyping", chatId, userId);
    }
}
