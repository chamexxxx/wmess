using System.ComponentModel.DataAnnotations;

namespace WMess.Api.Models.DTO.Teams;

public class UpdateTeamRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;
}
