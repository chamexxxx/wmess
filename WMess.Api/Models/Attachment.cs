using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMess.Api.Models;

public class Attachment
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int MessageId { get; set; }

    [Required]
    [MaxLength(300)]
    public string FileName { get; set; } = string.Empty;

    /// <summary>Имя файла на диске/в хранилище.</summary>
    [Required]
    [MaxLength(300)]
    public string StoredName { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string ContentType { get; set; } = string.Empty;

    [Required]
    public long Size { get; set; }

    [ForeignKey(nameof(MessageId))]
    public Message Message { get; set; } = null!;
}
