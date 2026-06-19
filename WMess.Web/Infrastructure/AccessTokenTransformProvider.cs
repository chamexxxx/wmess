using System.Net.Http.Headers;
using Microsoft.AspNetCore.Authentication;
using WMess.Web.Services;
using Yarp.ReverseProxy.Transforms;
using Yarp.ReverseProxy.Transforms.Builder;

namespace WMess.Web.Infrastructure;

public class AccessTokenTransformProvider : ITransformProvider
{
    public void ValidateRoute(TransformRouteValidationContext context)
    {
    }

    public void ValidateCluster(TransformClusterValidationContext context)
    {
    }

    public void Apply(TransformBuilderContext context)
    {
        context.AddRequestTransform(async transformContext =>
        {
            var token = await transformContext.HttpContext.GetTokenAsync(SessionManager.AccessTokenName);
            if (!string.IsNullOrEmpty(token))
            {
                transformContext.ProxyRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            }

            transformContext.ProxyRequest.Headers.Remove("Cookie");
        });
    }
}
