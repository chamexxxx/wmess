namespace WMess.Api.Models.DTO.Library;

/// <summary>Переименование элемента библиотеки (тип-агностично).</summary>
public class UpdateItemRequest
{
    public string Title { get; set; } = string.Empty;
}
