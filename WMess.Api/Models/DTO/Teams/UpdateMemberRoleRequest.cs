using System.ComponentModel.DataAnnotations;
using WMess.Api.Enums;

namespace WMess.Api.Models.DTO.Teams;

/// <summary>
/// Запрос на изменение роли участника
/// </summary>
public class UpdateMemberRoleRequest
{
    [Required]
    public TeamRole Role { get; set; }
}
