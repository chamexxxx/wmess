using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMess.Api.Models;

public class Team
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Навигационные свойства
    public ICollection<TeamUser> TeamUsers { get; set; } = new List<TeamUser>();
    public ICollection<Project> Projects { get; set; } = new List<Project>();
    public ICollection<TaskBoardColumn> TaskBoardColumns { get; set; } = new List<TaskBoardColumn>();
    public TeamScheduleSettings? ScheduleSettings { get; set; }
}
