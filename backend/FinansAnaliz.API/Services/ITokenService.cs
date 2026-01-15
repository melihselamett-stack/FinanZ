using FinansAnaliz.API.Models;

namespace FinansAnaliz.API.Services;

public interface ITokenService
{
    string GenerateToken(ApplicationUser user);
}

