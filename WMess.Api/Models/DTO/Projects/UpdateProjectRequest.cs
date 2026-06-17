using System.ComponentModel.DataAnnotations;

namespace WMess.Api.Models.DTO.Projects;

public class UpdateProjectRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    public int TeamId { get; set; }
}
