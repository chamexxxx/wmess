using Microsoft.AspNetCore.Diagnostics;

namespace WMess.Web.Infrastructure;

public class UpstreamExceptionHandler : IExceptionHandler
{
    public ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not HttpRequestException)
        {
            return ValueTask.FromResult(false);
        }

        httpContext.Response.StatusCode = StatusCodes.Status502BadGateway;
        return ValueTask.FromResult(true);
    }
}
