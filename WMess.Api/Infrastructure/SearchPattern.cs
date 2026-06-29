namespace WMess.Api.Infrastructure;

/// <summary>
/// Построение паттернов для регистронезависимого поиска через <c>ILIKE</c>.
/// </summary>
public static class SearchPattern
{
    /// <summary>Экранирующий символ для <c>ILIKE</c> (передаётся в ESCAPE-клаузу).</summary>
    public const string EscapeChar = "\\";

    /// <summary>
    /// Превращает пользовательский ввод в паттерн вхождения подстроки, экранируя
    /// спецсимволы LIKE (<c>%</c>, <c>_</c>, <c>\</c>), чтобы они не работали как маска.
    /// </summary>
    public static string Contains(string term)
    {
        var escaped = term
            .Replace("\\", "\\\\")
            .Replace("%", "\\%")
            .Replace("_", "\\_");

        return $"%{escaped}%";
    }
}
