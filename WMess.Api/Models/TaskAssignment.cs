namespace WMess.Api.Models;

public class TaskAssignment
{
    public Guid TaskId { get; set; }
    public TaskItem? Task { get; set; }

    public string UserId { get; set; } = string.Empty;
    public ApplicationUser? User { get; set; }
}
