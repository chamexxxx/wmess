using System.ComponentModel.DataAnnotations;

namespace WMess.Api.Models.DTO.Tasks;

public class TaskBoardColumnResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public string Color { get; set; } = string.Empty;
    public bool IsDoneColumn { get; set; }
}

public class CreateTaskColumnRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Color { get; set; } = "#808080";

    public bool IsDoneColumn { get; set; }
}

public class UpdateTaskColumnRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Color { get; set; } = "#808080";

    public bool IsDoneColumn { get; set; }
}

public class ReorderTaskColumnsRequest
{
    public List<ColumnOrderItem> Items { get; set; } = new();
}

public class ColumnOrderItem
{
    public Guid Id { get; set; }
    public int SortOrder { get; set; }
}
