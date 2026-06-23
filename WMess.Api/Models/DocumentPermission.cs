using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Identity;

namespace WMess.Api.Models;

public class DocumentPermission
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int DocumentId { get; set; }

    [Required]
    public string UserId { get; set; } = string.Empty;

    public bool CanView { get; set; } = true;

    public bool CanEdit { get; set; } = false;

    public bool CanManage { get; set; } = false;

    public DateTime GrantedAt { get; set; } = DateTime.UtcNow;

    // Навигационные свойства
    [ForeignKey(nameof(DocumentId))]
    public Document Document { get; set; } = null!;

    [ForeignKey(nameof(UserId))]
    public IdentityUser User { get; set; } = null!;
}
