using WMess.Web.Models.DTO;

namespace WMess.Web.Services;

public interface ISessionManager
{
    Task SignInAsync(HttpContext context, ApiAuthResponse auth);
    Task SignOutAsync(HttpContext context);
}
