using WMess.Api.Services;

namespace WMess.Api.Tests;

public class StubServicesTests
{
  [Fact]
  public async Task StubTaskResolver_ReturnsEmptyList()
  {
    var resolver = new StubTaskResolver();
    var result = await resolver.ResolveAsync("Задача #{42} в проекте");
    Assert.Empty(result);
  }

  [Fact]
  public async Task StubTranscription_ReturnsNull()
  {
    var service = new StubTranscriptionService();
    var result = await service.TranscribeAsync("file.webm", "audio/webm");
    Assert.Null(result);
  }
}
