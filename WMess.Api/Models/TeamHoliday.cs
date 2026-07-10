using System.ComponentModel.DataAnnotations;

namespace WMess.Api.Models;

public class TeamHoliday
{
    public Guid Id { get; set; }

    public int TeamId { get; set; }
    public Team? Team { get; set; }

    public DateOnly Date { get; set; }

    [MaxLength(100)]
    public string? Name { get; set; }
}
