namespace WMess.Api.Models.DTO.Library;

/// <summary>Элемент пути (хлебных крошек) до текущей папки.</summary>
public class BreadcrumbItem
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}
