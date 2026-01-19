using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using FinansAnaliz.API.Data;

namespace FinansAnaliz.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BilancoController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public BilancoController(ApplicationDbContext context)
    {
        _context = context;
    }

    private string GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    private async Task<bool> UserOwnsCompany(int companyId)
    {
        var userId = GetUserId();
        return await _context.Companies.AnyAsync(c => c.Id == companyId && c.UserId == userId);
    }

    [HttpGet("company/{companyId}")]
    public async Task<ActionResult<object>> GetBilanco(int companyId, [FromQuery] int? year)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        // Eğer yıl belirtilmemişse, en son yılı kullan
        if (!year.HasValue)
        {
            var lastYear = await _context.MonthlyBalances
                .Where(m => m.CompanyId == companyId)
                .OrderByDescending(m => m.Year)
                .Select(m => m.Year)
                .FirstOrDefaultAsync();

            if (lastYear == 0)
            {
                return Ok(new
                {
                    Year = 0,
                    Periods = new List<object>(),
                    Varliklar = new List<object>(),
                    Kaynaklar = new List<object>()
                });
            }

            year = lastYear;
        }

        // Tüm dönemleri getir (12 ay)
        var allPeriodsRaw = await _context.MonthlyBalances
            .Where(m => m.CompanyId == companyId && m.Year == year.Value)
            .Select(m => new { m.Year, m.Month })
            .Distinct()
            .OrderBy(p => p.Month)
            .ToListAsync();

        if (!allPeriodsRaw.Any())
        {
            return Ok(new
            {
                Year = year.Value,
                Periods = new List<object>(),
                Varliklar = new List<object>(),
                Kaynaklar = new List<object>()
            });
        }

        // Tuple list'e çevir
        var allPeriods = allPeriodsRaw.Select(p => (p.Year, p.Month)).ToList();

        // VARLIKLAR bölümü - Yüklenen mizan verilerinden hesapla
        var varliklarList = new List<object>();
        
        // DURAN VARLIKLAR (2.x.x hesap kodları)
        var duranVarliklar = await GetBilancoSection(companyId, year.Value, allPeriods, new[] { "2" });
        if (duranVarliklar.Count > 0)
        {
            foreach (var item in duranVarliklar)
            {
                varliklarList.Add(item);
            }
            var duranToplam = CalculateSectionTotal(duranVarliklar.Cast<object>().ToList(), allPeriods);
            varliklarList.Add(new { Name = "DURAN VARLIKLAR", IsCategory = true, Values = duranToplam });
        }

        // DÖNEN VARLIKLAR (1.x.x hesap kodları)
        var donenVarliklar = await GetBilancoSection(companyId, year.Value, allPeriods, new[] { "1" });
        if (donenVarliklar.Count > 0)
        {
            foreach (var item in donenVarliklar)
            {
                varliklarList.Add(item);
            }
            var donenToplam = CalculateSectionTotal(donenVarliklar.Cast<object>().ToList(), allPeriods);
            varliklarList.Add(new { Name = "DÖNEN VARLIKLAR", IsCategory = true, Values = donenToplam });
        }

        // TOPLAM VARLIKLAR
        if (varliklarList.Count > 0)
        {
            var toplamVarliklar = CalculateSectionTotal(
                varliklarList.Where(i => !IsCategoryOrTotalRow(i)).ToList(), 
                allPeriods
            );
            varliklarList.Add(new { Name = "TOPLAM VARLIKLAR", IsTotal = true, Values = toplamVarliklar });
        }

        // KAYNAKLAR bölümü
        var kaynaklarList = new List<object>();

        // ÖZKAYNAKLAR (5.x.x hesap kodları)
        var ozkaynaklar = await GetBilancoSection(companyId, year.Value, allPeriods, new[] { "5" });
        if (ozkaynaklar.Count > 0)
        {
            foreach (var item in ozkaynaklar)
            {
                kaynaklarList.Add(item);
            }
            var ozkaynakToplam = CalculateSectionTotal(ozkaynaklar.Cast<object>().ToList(), allPeriods);
            kaynaklarList.Add(new { Name = "ÖZKAYNAKLAR", IsCategory = true, Values = ozkaynakToplam });
        }

        // UZUN VADELİ KAYNAKLAR (4.x.x hesap kodları)
        var uzunVadeli = await GetBilancoSection(companyId, year.Value, allPeriods, new[] { "4" });
        if (uzunVadeli.Count > 0)
        {
            foreach (var item in uzunVadeli)
            {
                kaynaklarList.Add(item);
            }
            var uzunVadeliToplam = CalculateSectionTotal(uzunVadeli.Cast<object>().ToList(), allPeriods);
            kaynaklarList.Add(new { Name = "UZUN VADELİ KAYNAKLAR", IsCategory = true, Values = uzunVadeliToplam });
        }

        // KISA VADELİ YÜKÜMLÜLÜKLER (3.x.x hesap kodları)
        var kisaVadeli = await GetBilancoSection(companyId, year.Value, allPeriods, new[] { "3" });
        if (kisaVadeli.Count > 0)
        {
            foreach (var item in kisaVadeli)
            {
                kaynaklarList.Add(item);
            }
            var kisaVadeliToplam = CalculateSectionTotal(kisaVadeli.Cast<object>().ToList(), allPeriods);
            kaynaklarList.Add(new { Name = "KISA VADELİ YÜKÜMLÜLÜKLER", IsCategory = true, Values = kisaVadeliToplam });
        }

        // TOPLAM KAYNAKLAR
        if (kaynaklarList.Count > 0)
        {
            var toplamKaynaklar = CalculateSectionTotal(
                kaynaklarList.Where(i => !IsCategoryOrTotalRow(i)).ToList(), 
                allPeriods
            );
            kaynaklarList.Add(new { Name = "TOPLAM KAYNAKLAR", IsTotal = true, Values = toplamKaynaklar });
        }

        return Ok(new
        {
            Year = year.Value,
            Periods = allPeriodsRaw.Select(p => new { p.Year, p.Month }).ToList(),
            Varliklar = varliklarList,
            Kaynaklar = kaynaklarList
        });
    }

    private async Task<List<Dictionary<string, object>>> GetBilancoSection(
        int companyId, 
        int year, 
        List<(int Year, int Month)> periods, 
        string[] codePrefixes)
    {
        var items = new List<Dictionary<string, object>>();

        // Yüklenen mizan verilerinden hesapları getir
        var accountsWithBalances = await _context.MonthlyBalances
            .Include(m => m.AccountPlan)
            .Where(m => m.CompanyId == companyId && 
                       m.Year == year &&
                       m.AccountPlan != null &&
                       codePrefixes.Any(prefix => m.AccountPlan!.AccountCode.StartsWith(prefix)))
            .GroupBy(m => new { m.AccountPlanId, m.AccountPlan!.AccountCode, m.AccountPlan.AccountName })
            .Select(g => new
            {
                AccountId = g.Key.AccountPlanId,
                AccountCode = g.Key.AccountCode,
                AccountName = g.Key.AccountName,
                Balances = g.Select(b => new
                {
                    b.Month,
                    b.DebitBalance,
                    b.CreditBalance
                }).ToList()
            })
            .ToListAsync();

        foreach (var accountData in accountsWithBalances)
        {
            var values = new Dictionary<string, decimal>();
            decimal total = 0;

            // Her dönem için bakiye hesapla
            foreach (var (periodYear, periodMonth) in periods)
            {
                var balance = accountData.Balances
                    .Where(b => b.Month == periodMonth)
                    .Select(b => b.DebitBalance - b.CreditBalance)
                    .FirstOrDefault();

                var periodKey = $"{periodMonth}";
                values[periodKey] = balance;
                total += balance;
            }

            values["Total"] = total;

            items.Add(new Dictionary<string, object>
            {
                { "Name", accountData.AccountName },
                { "AccountCode", accountData.AccountCode },
                { "Values", values }
            });
        }

        // Hesap koduna göre sırala
        items = items.OrderBy(i => i["AccountCode"].ToString()).ToList();

        return items;
    }

    private Dictionary<string, decimal> CalculateSectionTotal(
        List<object> items, 
        List<(int Year, int Month)> periods)
    {
        var total = new Dictionary<string, decimal>();
        
        foreach (var (periodYear, periodMonth) in periods)
        {
            total[$"{periodMonth}"] = 0;
        }
        total["Total"] = 0;

        foreach (var item in items)
        {
            if (item is Dictionary<string, object> itemDict && itemDict.ContainsKey("Values"))
            {
                if (itemDict["Values"] is Dictionary<string, decimal> values)
                {
                    foreach (var (periodYear, periodMonth) in periods)
                    {
                        var key = $"{periodMonth}";
                        if (values.ContainsKey(key))
                        {
                            total[key] += values[key];
                        }
                    }
                    if (values.ContainsKey("Total"))
                    {
                        total["Total"] += values["Total"];
                    }
                }
            }
        }

        return total;
    }

    private bool IsCategoryOrTotalRow(object item)
    {
        if (item is Dictionary<string, object> dict)
        {
            return dict.ContainsKey("IsCategory") || dict.ContainsKey("IsTotal");
        }
        // Anonymous type kontrolü
        var type = item.GetType();
        return type.GetProperty("IsCategory") != null || type.GetProperty("IsTotal") != null;
    }
}
