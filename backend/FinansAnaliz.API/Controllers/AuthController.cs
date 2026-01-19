using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Google.Apis.Auth;
using FinansAnaliz.API.Data;
using FinansAnaliz.API.Models;
using FinansAnaliz.API.DTOs;
using FinansAnaliz.API.Services;

namespace FinansAnaliz.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly ITokenService _tokenService;
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        ITokenService tokenService,
        ApplicationDbContext context,
        IConfiguration configuration)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _tokenService = tokenService;
        _context = context;
        _configuration = configuration;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request)
    {
        var existingUser = await _userManager.FindByEmailAsync(request.Email);
        if (existingUser != null)
        {
            return BadRequest(new AuthResponse { Success = false, Message = "Bu email zaten kayıtlı" });
        }

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            FullName = request.FullName,
            CreatedAt = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return BadRequest(new AuthResponse 
            { 
                Success = false, 
                Message = string.Join(", ", result.Errors.Select(e => e.Description)) 
            });
        }

        var token = _tokenService.GenerateToken(user);
        var hasSubscription = await _context.UserSubscriptions
            .AnyAsync(s => s.UserId == user.Id && s.IsActive && s.EndDate > DateTime.UtcNow);

        return Ok(new AuthResponse
        {
            Success = true,
            Token = token,
            User = new UserInfo
            {
                Id = user.Id,
                Email = user.Email!,
                FullName = user.FullName,
                HasSubscription = hasSubscription
            }
        });
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user == null)
        {
            return Unauthorized(new AuthResponse { Success = false, Message = "Geçersiz email veya şifre" });
        }

        var result = await _signInManager.CheckPasswordSignInAsync(user, request.Password, false);
        if (!result.Succeeded)
        {
            return Unauthorized(new AuthResponse { Success = false, Message = "Geçersiz email veya şifre" });
        }

        var token = _tokenService.GenerateToken(user);
        var hasSubscription = await _context.UserSubscriptions
            .AnyAsync(s => s.UserId == user.Id && s.IsActive && s.EndDate > DateTime.UtcNow);

        return Ok(new AuthResponse
        {
            Success = true,
            Token = token,
            User = new UserInfo
            {
                Id = user.Id,
                Email = user.Email!,
                FullName = user.FullName,
                HasSubscription = hasSubscription
            }
        });
    }

    [HttpPost("google")]
    public async Task<ActionResult<AuthResponse>> GoogleLogin([FromBody] GoogleLoginRequest request)
    {
        try
        {
            var clientId = _configuration["GoogleAuth:ClientId"];
            var settings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { clientId }
            };

            var payload = await GoogleJsonWebSignature.ValidateAsync(request.IdToken, settings);
            
            var user = await _userManager.FindByEmailAsync(payload.Email);
            if (user == null)
            {
                user = new ApplicationUser
                {
                    UserName = payload.Email,
                    Email = payload.Email,
                    FullName = payload.Name ?? payload.Email,
                    EmailConfirmed = true,
                    CreatedAt = DateTime.UtcNow
                };

                var result = await _userManager.CreateAsync(user);
                if (!result.Succeeded)
                {
                    return BadRequest(new AuthResponse 
                    { 
                        Success = false, 
                        Message = "Kullanıcı oluşturulamadı" 
                    });
                }
            }

            var token = _tokenService.GenerateToken(user);
            var hasSubscription = await _context.UserSubscriptions
                .AnyAsync(s => s.UserId == user.Id && s.IsActive && s.EndDate > DateTime.UtcNow);

            return Ok(new AuthResponse
            {
                Success = true,
                Token = token,
                User = new UserInfo
                {
                    Id = user.Id,
                    Email = user.Email!,
                    FullName = user.FullName,
                    HasSubscription = hasSubscription
                }
            });
        }
        catch (InvalidJwtException)
        {
            return Unauthorized(new AuthResponse { Success = false, Message = "Geçersiz Google token" });
        }
    }

    [HttpPost("forgot-password")]
    public async Task<ActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user == null)
        {
            // Güvenlik için kullanıcı bulunamadı mesajı vermiyoruz
            return Ok(new { Success = true, Message = "Eğer bu email adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderildi" });
        }

        // Şifre sıfırlama token'ı oluştur
        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        
        // Yeni şifre ile sıfırla
        var result = await _userManager.ResetPasswordAsync(user, token, request.NewPassword);
        
        if (!result.Succeeded)
        {
            return BadRequest(new AuthResponse 
            { 
                Success = false, 
                Message = string.Join(", ", result.Errors.Select(e => e.Description)) 
            });
        }

        return Ok(new { Success = true, Message = "Şifreniz başarıyla sıfırlandı" });
    }

    [HttpPost("check-email")]
    public async Task<ActionResult> CheckEmail([FromBody] CheckEmailRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user == null)
        {
            return Ok(new { Exists = false });
        }

        return Ok(new { 
            Exists = true,
            Email = user.Email,
            FullName = user.FullName
        });
    }
}

