using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using FinansAnaliz.API.Data;
using FinansAnaliz.API.DTOs;
using FinansAnaliz.API.Services;

namespace FinansAnaliz.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MizanController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IMizanService _mizanService;

    public MizanController(ApplicationDbContext context, IMizanService mizanService)
    {
        _context = context;
        _mizanService = mizanService;
    }

    private string GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    private async Task<bool> UserOwnsCompany(int companyId)
    {
        var userId = GetUserId();
        return await _context.Companies.AnyAsync(c => c.Id == companyId && c.UserId == userId);
    }

    [HttpPost("upload")]
    public async Task<ActionResult<MizanUploadResult>> Upload([FromForm] int companyId, [FromForm] int year, [FromForm] int month, IFormFile file)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        if (file == null || file.Length == 0)
            return BadRequest(new MizanUploadResult { Success = false, ErrorMessage = "Dosya yüklenmedi" });

        var extension = Path.GetExtension(file.FileName).ToLower();
        if (extension != ".xlsx" && extension != ".xls")
            return BadRequest(new MizanUploadResult { Success = false, ErrorMessage = "Sadece Excel dosyaları (.xlsx, .xls) kabul edilir" });

        using var stream = file.OpenReadStream();
        var result = await _mizanService.UploadMizanAsync(companyId, year, month, stream);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("company/{companyId}/periods")]
    public async Task<ActionResult<List<object>>> GetPeriods(int companyId)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        var periods = await _context.MonthlyBalances
            .Where(m => m.CompanyId == companyId)
            .Select(m => new { m.Year, m.Month })
            .Distinct()
            .OrderByDescending(p => p.Year)
            .ThenByDescending(p => p.Month)
            .ToListAsync();

        return Ok(periods);
    }

    [HttpGet("company/{companyId}/balances")]
    public async Task<ActionResult<List<object>>> GetBalances(int companyId, [FromQuery] int year, [FromQuery] int month)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        var balances = await _context.MonthlyBalances
            .Include(m => m.AccountPlan)
            .Where(m => m.CompanyId == companyId && m.Year == year && m.Month == month)
            .OrderBy(m => m.AccountPlan!.AccountCode)
            .Select(m => new
            {
                m.Id,
                m.AccountPlan!.AccountCode,
                m.AccountPlan.AccountName,
                m.Debit,
                m.Credit,
                m.DebitBalance,
                m.CreditBalance,
                m.AccountPlan.Property1,
                m.AccountPlan.Property2,
                m.AccountPlan.Property3,
                m.AccountPlan.Property4,
                m.AccountPlan.Property5,
                m.AccountPlan.IsLeaf
            })
            .ToListAsync();

        return Ok(balances);
    }

    [HttpGet("company/{companyId}/consolidated")]
    public async Task<ActionResult<object>> GetConsolidatedMizan(int companyId)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        // Tüm dönemleri getir
        var periods = await _context.MonthlyBalances
            .Where(m => m.CompanyId == companyId)
            .Select(m => new { m.Year, m.Month })
            .Distinct()
            .OrderBy(p => p.Year)
            .ThenBy(p => p.Month)
            .ToListAsync();

        if (!periods.Any())
        {
            return Ok(new
            {
                Periods = new List<object>(),
                Accounts = new List<object>()
            });
        }

        // Tüm hesapları getir (hesap planından veya mizan verilerinden)
        // Önce hesap planından dene, yoksa mizan verilerinden account bilgilerini al
        var accountsFromPlanRaw = await _context.AccountPlans
            .Where(a => a.CompanyId == companyId)
            .OrderBy(a => a.AccountCode)
            .Select(a => new
            {
                a.Id,
                a.AccountCode,
                a.AccountName,
                a.Property1,
                a.Property2,
                a.Property3,
                a.Property4,
                a.Property5,
                a.IsLeaf,
                a.AssignedPropertyIndex,
                a.AssignedPropertyValue,
                a.CostCenter
            })
            .ToListAsync();

        // Memory'de Level hesapla
        var accountsFromPlan = accountsFromPlanRaw.Select(a => new
        {
            a.Id,
            a.AccountCode,
            a.AccountName,
            Level = a.AccountCode.Split('.').Length,
            a.Property1,
            a.Property2,
            a.Property3,
            a.Property4,
            a.Property5,
            a.IsLeaf,
            a.AssignedPropertyIndex,
            a.AssignedPropertyValue,
            a.CostCenter
        }).ToList();

        // Eğer hesap planı boşsa, mizan verilerinden account bilgilerini çek
        var accounts = accountsFromPlan;
        if (!accounts.Any())
        {
            var accountsFromBalancesRaw = await _context.MonthlyBalances
                .Include(m => m.AccountPlan)
                .Where(m => m.CompanyId == companyId && m.AccountPlan != null)
                .Select(m => new
                {
                    m.AccountPlan!.Id,
                    m.AccountPlan.AccountCode,
                    m.AccountPlan.AccountName,
                    m.AccountPlan.Property1,
                    m.AccountPlan.Property2,
                    m.AccountPlan.Property3,
                    m.AccountPlan.Property4,
                    m.AccountPlan.Property5,
                    m.AccountPlan.IsLeaf,
                    m.AccountPlan.AssignedPropertyIndex,
                    m.AccountPlan.AssignedPropertyValue,
                    m.AccountPlan.CostCenter
                })
                .Distinct()
                .OrderBy(a => a.AccountCode)
                .ToListAsync();
            
            // Memory'de Level hesapla
            accounts = accountsFromBalancesRaw.Select(a => new
            {
                a.Id,
                a.AccountCode,
                a.AccountName,
                Level = a.AccountCode.Split('.').Length,
                a.Property1,
                a.Property2,
                a.Property3,
                a.Property4,
                a.Property5,
                a.IsLeaf,
                a.AssignedPropertyIndex,
                a.AssignedPropertyValue,
                a.CostCenter
            }).ToList();
        }

        // Her hesap için tüm dönemlerdeki bakiyeleri getir
        var balancesByAccount = await _context.MonthlyBalances
            .Include(m => m.AccountPlan)
            .Where(m => m.CompanyId == companyId)
            .GroupBy(m => m.AccountPlanId)
            .Select(g => new
            {
                AccountPlanId = g.Key,
                Balances = g.Select(b => new
                {
                    b.Year,
                    b.Month,
                    b.DebitBalance,
                    b.CreditBalance
                }).ToList()
            })
            .ToListAsync();

        // Sonuçları birleştir
        var result = new
        {
            Periods = periods,
            Accounts = accounts.Select(a => new
            {
                a.Id,
                a.AccountCode,
                a.AccountName,
                a.Level,
                a.Property1,
                a.Property2,
                a.Property3,
                a.Property4,
                a.Property5,
                a.IsLeaf,
                a.AssignedPropertyIndex,
                a.AssignedPropertyValue,
                a.CostCenter,
                Balances = balancesByAccount
                    .Where(b => b.AccountPlanId == a.Id)
                    .SelectMany(b => b.Balances)
                    .Select(b => new
                    {
                        PeriodKey = $"{b.Year}-{b.Month}",
                        b.Year,
                        b.Month,
                        b.DebitBalance,
                        b.CreditBalance,
                        NetBalance = b.DebitBalance - b.CreditBalance
                    })
                    .ToList()
            }).ToList()
        };

        return Ok(result);
    }

    [HttpDelete("company/{companyId}/period")]
    public async Task<IActionResult> DeletePeriod(int companyId, [FromQuery] int year, [FromQuery] int month)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        var balances = await _context.MonthlyBalances
            .Where(m => m.CompanyId == companyId && m.Year == year && m.Month == month)
            .ToListAsync();

        _context.MonthlyBalances.RemoveRange(balances);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}

