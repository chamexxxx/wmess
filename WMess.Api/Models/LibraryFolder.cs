using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMess.Api.Models;

public class LibraryFolder
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
    public LibraryFolder? ParentFolder { get; set; }

    public ICollection<LibraryFolder> SubFolders { get; set; } = new List<LibraryFolder>();
    public ICollection<LibraryItem> Items { get; set; } = new List<LibraryItem>();
}
