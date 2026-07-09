namespace WMess.Api.Models;

/// <summary>
/// Тип элемента библиотеки. Общая обвязка (папки, права, размещение в проекте)
/// одинакова для всех типов; контент хранится в отдельной 1:1 сущности на тип
/// (<see cref="DocumentContent"/> и т.д.).
/// </summary>
public enum LibraryItemType
{
    Document = 0,
    Board = 1,
    Table = 2,
    File = 3,
    Link = 4,
}
