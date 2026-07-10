namespace WMess.Api.Enums;

/// <summary>
/// Режим ответа на сообщение. Thread — Mattermost-тред от корня; Flat — Telegram-style.
/// </summary>
public enum ReplyMode
{
    Thread = 0,
    Flat = 1
}
