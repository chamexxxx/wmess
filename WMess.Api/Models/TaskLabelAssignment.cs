namespace WMess.Api.Models;

public class TaskLabelAssignment
{
    public Guid TaskId { get; set; }
    public TaskItem? Task { get; set; }

    public Guid LabelId { get; set; }
    public TaskLabelDefinition? Label { get; set; }
}
