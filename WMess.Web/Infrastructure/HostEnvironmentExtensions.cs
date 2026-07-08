namespace WMess.Web.Infrastructure;

internal static class HostEnvironmentExtensions
{
    public static bool IsDockerLike(this IHostEnvironment environment) =>
        environment.IsEnvironment("Docker") || environment.IsEnvironment("DockerLocal");
}
