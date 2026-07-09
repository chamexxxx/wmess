using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Identity;
using WMess.Api.Enums;

namespace WMess.Api.Models;

public class Message
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ChatId { get; set; }

    [Required]
    public string AuthorId { get; set; } = string.Empty;

    /// <summary>
    /// Текст сообщения. Может быть пустым при наличии вложений.
    /// </summary>
    public string? Content { get; set; }

    /// <summary>
    /// Родительское сообщение (ответ). Для тредов Mattermost — корень треда;
    /// для плоских ответов Telegram-style — цитируемое/ответное сообщение.
    /// </summary>
    public int? ParentMessageId { get; set; }

    /// <summary>Режим ответа (Thread / Flat), если сообщение — ответ.</summary>
    public ReplyMode? ReplyMode { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? EditedAt { get; set; }

    /// <summary>Расшифровка голосового сообщения (под будущий Whisper).</summary>
    public string? Transcription { get; set; }

    /// <summary>Пики waveform голосового сообщения (JSON-массив амплитуд).</summary>
    public string? WaveformData { get; set; }

    /// <summary>Идентификатор комнаты Jitsi для сообщения-приглашения на созвон.</summary>
    [MaxLength(200)]
    public string? CallRoomId { get; set; }

    /// <summary>Тип созвона: audio или video.</summary>
    [MaxLength(16)]
    public string? CallType { get; set; }

    // Навигационные свойства
    [ForeignKey(nameof(ChatId))]
    public Chat Chat { get; set; } = null!;

    [ForeignKey(nameof(AuthorId))]
    public IdentityUser Author { get; set; } = null!;

    [ForeignKey(nameof(ParentMessageId))]
    public Message? ParentMessage { get; set; }

    public ICollection<Attachment> Attachments { get; set; } = new List<Attachment>();
    public ICollection<Reaction> Reactions { get; set; } = new List<Reaction>();
}
