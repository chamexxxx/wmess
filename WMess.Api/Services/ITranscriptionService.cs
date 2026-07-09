namespace WMess.Api.Services;

/// <summary>
/// Абстракция расшифровки голосовых сообщений (под будущий Whisper).
/// Сейчас реализация — заглушка, возвращающая пустой результат.
/// </summary>
public interface ITranscriptionService
{
    /// <summary>
    /// Асинхронно расшифровывает аудиовложение. Заглушка: возвращает null.
    /// </summary>
    Task<string?> TranscribeAsync(string storedName, string contentType, CancellationToken cancellationToken = default);
}

/// <summary>
/// Заглушка <see cref="ITranscriptionService"/>: расшифровка не выполняется.
/// Архитектурно заложена точка расширения для подключения Whisper.
/// </summary>
public class StubTranscriptionService : ITranscriptionService
{
    public Task<string?> TranscribeAsync(string storedName, string contentType, CancellationToken cancellationToken = default)
    {
        return Task.FromResult<string?>(null);
    }
}
