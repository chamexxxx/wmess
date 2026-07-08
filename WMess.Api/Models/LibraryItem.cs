using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Identity;

namespace WMess.Api.Models;

/// <summary>
/// Элемент библиотеки проекта. Несёт общие поля для всех типов (размещение в папке,
/// заголовок, автор). Контент, специфичный для типа, живёт в отдельной 1:1
/// сущности (например <see cref="DocumentContent"/>).
/// </summary>
public class LibraryItem
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ProjectId { get; set; }

    public int? FolderId { get; set; }

    [Required]
    public LibraryItemType Type { get; set; } = LibraryItemType.Document;

    [Required]
    [MaxLength(300)]
    public string Title { get; set; } = "Untitled Document";

    [Required]
    public string CreatedBy { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Навигационные свойства
    [ForeignKey(nameof(ProjectId))]
    public Project Project { get; set; } = null!;

    [ForeignKey(nameof(FolderId))]
    public LibraryFolder? Folder { get; set; }

    [ForeignKey(nameof(CreatedBy))]
    public IdentityUser Creator { get; set; } = null!;

    // Контент типа Document (1:1, PK = FK). Для прочих типов появятся свои content-сущности.
    public DocumentContent? DocumentContent { get; set; }

    // Контент типа Board (1:1, PK = FK).
    public BoardContent? BoardContent { get; set; }
}
