namespace WMess.Api.Services;

/// <summary>
/// Резолв ссылок на задачи #{номер} в тексте сообщения (под будущую интеграцию).
/// </summary>
public interface ITaskResolver
{
  Task<IReadOnlyList<InlineEntity>> ResolveAsync(string? content, CancellationToken cancellationToken = default);
}

public sealed class InlineEntity
{
  public string Type { get; set; } = "task";
  public int Id { get; set; }
  public string Title { get; set; } = string.Empty;
  public string? Preview { get; set; }
}

/// <summary>
/// Заглушка <see cref="ITaskResolver"/> — inline-сущности не резолвятся.
/// </summary>
public class StubTaskResolver : ITaskResolver
{
  public Task<IReadOnlyList<InlineEntity>> ResolveAsync(string? content, CancellationToken cancellationToken = default)
  {
    return Task.FromResult<IReadOnlyList<InlineEntity>>(Array.Empty<InlineEntity>());
  }
}
