using System.Net.Http.Json;
using WMess.Web.Models.DTO;

namespace WMess.Web.Services;

public class AuthApiClient : IAuthApiClient
{
    private readonly HttpClient _httpClient;

    public AuthApiClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<ApiAuthResponse?> LoginAsync(LoginRequest request)
    {
        var response = await _httpClient.PostAsJsonAsync("api/auth/login", request);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        return await response.Content.ReadFromJsonAsync<ApiAuthResponse>();
    }

    public async Task<UpstreamResponse> RegisterAsync(RegisterRequest request)
    {
        var response = await _httpClient.PostAsJsonAsync("api/auth/register", request);
        return new UpstreamResponse
        {
            StatusCode = (int)response.StatusCode,
            Body = await response.Content.ReadAsStringAsync()
        };
    }
}
