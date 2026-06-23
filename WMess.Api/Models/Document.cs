using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Identity;

namespace WMess.Api.Models;

public class Document
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ProjectId { get; set; }

    public int? FolderId { get; set; }

    [Required]
    [MaxLength(300)]
    public string Title { get; set; } = "Untitled Document";

    // Yjs state хранится как binary blob
    public byte[]? YjsState { get; set; }

    [Required]
    public string CreatedBy { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Навигационные свойства
    [ForeignKey(nameof(ProjectId))]
    public Project Project { get; set; } = null!;

    [ForeignKey(nameof(FolderId))]
    public DocumentFolder? Folder { get; set; }

    [ForeignKey(nameof(CreatedBy))]
    public IdentityUser Creator { get; set; } = null!;

    public ICollection<DocumentPermission> Permissions { get; set; } = new List<DocumentPermission>();
}
