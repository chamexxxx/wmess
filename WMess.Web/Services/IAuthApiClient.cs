using WMess.Web.Models.DTO;

namespace WMess.Web.Services;

public interface IAuthApiClient
{
    Task<ApiAuthResponse?> LoginAsync(LoginRequest request);
    Task<UpstreamResponse> RegisterAsync(RegisterRequest request);
}
