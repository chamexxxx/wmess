namespace WMess.Api.Models.DTO.Projects;

public class ProjectResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int TeamId { get; set; }
    public DateTime CreatedAt { get; set; }
}
