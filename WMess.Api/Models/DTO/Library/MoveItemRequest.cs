namespace WMess.Api.Models.DTO.Library;

/// <summary>Перемещение элемента библиотеки в другую папку (тип-агностично).</summary>
public class MoveItemRequest
{
    public int? FolderId { get; set; }
}
