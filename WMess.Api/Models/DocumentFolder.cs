using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMess.Api.Models;

public class DocumentFolder
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ProjectId { get; set; }

    public int? ParentFolderId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Навигационные свойства
    [ForeignKey(nameof(ProjectId))]
    public Project Project { get; set; } = null!;

    [ForeignKey(nameof(ParentFolderId))]
    public DocumentFolder? ParentFolder { get; set; }

    public ICollection<DocumentFolder> SubFolders { get; set; } = new List<DocumentFolder>();
    public ICollection<Document> Documents { get; set; } = new List<Document>();
}
