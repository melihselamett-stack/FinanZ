using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using FinansAnaliz.API.Data;
using FinansAnaliz.API.Models;

namespace FinansAnaliz.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PackageController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public PackageController(ApplicationDbContext context)
    {
        _context = context;
    }

    private string? GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);

    [HttpGet]
    public async Task<ActionResult<List<object>>> GetPackages()
    {
        var packages = await _context.Packages
            .Where(p => p.IsActive)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Description,
                p.MonthlyPrice
            })
            .ToListAsync();

        return Ok(packages);
    }

    [HttpGet("my-subscription")]
    [Authorize]
    public async Task<ActionResult<object>> GetMySubscription()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var subscription = await _context.UserSubscriptions
            .Include(s => s.Package)
            .FirstOrDefaultAsync(s => s.UserId == userId && s.IsActive);

        if (subscription == null)
        {
            return Ok(new { hasSubscription = false });
        }

        return Ok(new
        {
            hasSubscription = true,
            packageName = subscription.Package?.Name,
            startDate = subscription.StartDate,
            endDate = subscription.EndDate,
            isActive = subscription.IsActive && subscription.EndDate > DateTime.UtcNow
        });
    }

    [HttpPost("subscribe/{packageId}")]
    [Authorize]
    public async Task<IActionResult> Subscribe(int packageId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var package = await _context.Packages.FindAsync(packageId);
        if (package == null || !package.IsActive)
        {
            return NotFound("Paket bulunamadı");
        }

        // Mevcut aboneliği iptal et
        var existingSubscription = await _context.UserSubscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.IsActive);

        if (existingSubscription != null)
        {
            existingSubscription.IsActive = false;
        }

        // Yeni abonelik oluştur
        var subscription = new UserSubscription
        {
            UserId = userId,
            PackageId = packageId,
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddMonths(1),
            IsActive = true
        };

        _context.UserSubscriptions.Add(subscription);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Abonelik başarıyla oluşturuldu" });
    }

    [HttpPost("cancel")]
    [Authorize]
    public async Task<IActionResult> CancelSubscription()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var subscription = await _context.UserSubscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.IsActive);

        if (subscription == null)
        {
            return NotFound("Aktif abonelik bulunamadı");
        }

        subscription.IsActive = false;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Abonelik iptal edildi" });
    }
}

