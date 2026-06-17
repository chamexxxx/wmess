using System.ComponentModel.DataAnnotations;

namespace WMess.Api.Models.DTO.Teams;

public class CreateTeamRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;
}
