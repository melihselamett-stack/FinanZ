using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using FinansAnaliz.API.Data;
using FinansAnaliz.API.Models;

namespace FinansAnaliz.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GelirRaporlariController : ControllerBase
{
    private const string AccountCodePrefix = "6"; // 6'lı hesaplar (gelir)

    private readonly ApplicationDbContext _context;

    public GelirRaporlariController(ApplicationDbContext context)
    {
        _context = context;
    }

    private string GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    private async Task<bool> UserOwnsCompany(int companyId)
    {
        var userId = GetUserId();
        return await _context.Companies.AnyAsync(c => c.Id == companyId && c.UserId == userId);
    }

    [HttpGet("company/{companyId}/properties")]
    public async Task<ActionResult<object>> GetAvailableProperties(int companyId)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        var company = await _context.Companies.FindAsync(companyId);
        if (company == null)
            return NotFound();

        var properties = new List<object>();

        for (int i = 1; i <= 5; i++)
        {
            bool hasValues = false;
            List<string> allValues = new List<string>();

            if (i == 1)
            {
                hasValues = await _context.AccountPlans
                    .AnyAsync(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property1) && a.AccountCode.StartsWith(AccountCodePrefix));
                if (hasValues)
                {
                    var values = await _context.AccountPlans
                        .Where(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property1) && a.AccountCode.StartsWith(AccountCodePrefix))
                        .Select(a => a.Property1!)
                        .Distinct()
                        .OrderBy(v => v)
                        .ToListAsync();
                    allValues = values;
                }
            }
            else if (i == 2)
            {
                hasValues = await _context.AccountPlans
                    .AnyAsync(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property2) && a.AccountCode.StartsWith(AccountCodePrefix));
                if (hasValues)
                {
                    var values = await _context.AccountPlans
                        .Where(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property2) && a.AccountCode.StartsWith(AccountCodePrefix))
                        .Select(a => a.Property2!)
                        .Distinct()
                        .OrderBy(v => v)
                        .ToListAsync();
                    allValues = values;
                }
            }
            else if (i == 3)
            {
                hasValues = await _context.AccountPlans
                    .AnyAsync(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property3) && a.AccountCode.StartsWith(AccountCodePrefix));
                if (hasValues)
                {
                    var values = await _context.AccountPlans
                        .Where(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property3) && a.AccountCode.StartsWith(AccountCodePrefix))
                        .Select(a => a.Property3!)
                        .Distinct()
                        .OrderBy(v => v)
                        .ToListAsync();
                    allValues = values;
                }
            }
            else if (i == 4)
            {
                hasValues = await _context.AccountPlans
                    .AnyAsync(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property4) && a.AccountCode.StartsWith(AccountCodePrefix));
                if (hasValues)
                {
                    var values = await _context.AccountPlans
                        .Where(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property4) && a.AccountCode.StartsWith(AccountCodePrefix))
                        .Select(a => a.Property4!)
                        .Distinct()
                        .OrderBy(v => v)
                        .ToListAsync();
                    allValues = values;
                }
            }
            else
            {
                hasValues = await _context.AccountPlans
                    .AnyAsync(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property5) && a.AccountCode.StartsWith(AccountCodePrefix));
                if (hasValues)
                {
                    var values = await _context.AccountPlans
                        .Where(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property5) && a.AccountCode.StartsWith(AccountCodePrefix))
                        .Select(a => a.Property5!)
                        .Distinct()
                        .OrderBy(v => v)
                        .ToListAsync();
                    allValues = values;
                }
            }

            if (hasValues && allValues.Any())
            {
                string propertyName = i switch
                {
                    1 => company.PropertyName1 ?? "Özellik 1",
                    2 => company.PropertyName2 ?? "Özellik 2",
                    3 => company.PropertyName3 ?? "Özellik 3",
                    4 => company.PropertyName4 ?? "Özellik 4",
                    _ => company.PropertyName5 ?? "Özellik 5"
                };
                properties.Add(new { Index = i, Name = propertyName, Values = allValues });
            }
        }

        return Ok(properties);
    }

    [HttpGet("company/{companyId}/account-codes")]
    public async Task<ActionResult<object>> GetAccountCodes(int companyId, [FromQuery] string? search = null)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        var accountsFromPlan = _context.AccountPlans
            .Where(a => a.CompanyId == companyId && a.IsLeaf == true && a.AccountCode.StartsWith(AccountCodePrefix));

        if (!string.IsNullOrEmpty(search))
        {
            accountsFromPlan = accountsFromPlan.Where(a =>
                a.AccountCode.Contains(search) ||
                a.AccountName.Contains(search));
        }

        var planAccounts = await accountsFromPlan
            .Select(a => new { AccountCode = a.AccountCode, AccountName = a.AccountName })
            .ToListAsync();

        var accountsFromBalances = _context.MonthlyBalances
            .Include(m => m.AccountPlan)
            .Where(m => m.CompanyId == companyId &&
                       m.AccountPlan != null &&
                       m.AccountPlan.IsLeaf == true &&
                       m.AccountPlan.AccountCode.StartsWith(AccountCodePrefix));

        if (!string.IsNullOrEmpty(search))
        {
            accountsFromBalances = accountsFromBalances.Where(m =>
                m.AccountPlan!.AccountCode.Contains(search) ||
                m.AccountPlan.AccountName.Contains(search));
        }

        var balanceAccounts = await accountsFromBalances
            .Select(m => new { AccountCode = m.AccountPlan!.AccountCode, AccountName = m.AccountPlan.AccountName })
            .Distinct()
            .ToListAsync();

        var allAccounts = planAccounts
            .Concat(balanceAccounts)
            .GroupBy(a => a.AccountCode)
            .Select(g => g.First())
            .OrderBy(a => a.AccountCode)
            .Take(100)
            .ToList();

        return Ok(allAccounts);
    }

    [HttpPost("company/{companyId}/report")]
    public async Task<ActionResult<object>> GetGelirRaporu(
        int companyId,
        [FromQuery] int? year,
        [FromBody] GelirRaporuRequest request)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        if (!year.HasValue)
        {
            var lastYear = await _context.MonthlyBalances
                .Where(m => m.CompanyId == companyId)
                .OrderByDescending(m => m.Year)
                .Select(m => m.Year)
                .FirstOrDefaultAsync();
            if (lastYear == 0)
                return Ok(new { Year = 0, Periods = new List<object>(), Groups = new List<object>() });
            year = lastYear;
        }

        var allPeriodsRaw = await _context.MonthlyBalances
            .Where(m => m.CompanyId == companyId && m.Year == year.Value)
            .Select(m => new { m.Year, m.Month })
            .Distinct()
            .OrderBy(p => p.Month)
            .ToListAsync();

        if (!allPeriodsRaw.Any())
            return Ok(new { Year = year.Value, Periods = new List<object>(), Groups = new List<object>() });

        var allPeriods = allPeriodsRaw.Select(p => (p.Year, p.Month)).ToList();
        var groups = new List<object>();

        foreach (var group in request.Groups)
        {
            var groupData = new List<object>();

            foreach (var item in group.Items)
            {
                var query = _context.MonthlyBalances
                    .Include(m => m.AccountPlan)
                    .Where(m => m.CompanyId == companyId &&
                               m.Year == year.Value &&
                               m.AccountPlan != null &&
                               m.AccountPlan.IsLeaf == true &&
                               m.AccountPlan.AccountCode.StartsWith(AccountCodePrefix));

                if (item.PropertyFilters != null)
                {
                    foreach (var filter in item.PropertyFilters)
                    {
                        query = filter.PropertyIndex switch
                        {
                            1 => query.Where(m => m.AccountPlan!.Property1 == filter.PropertyValue),
                            2 => query.Where(m => m.AccountPlan!.Property2 == filter.PropertyValue),
                            3 => query.Where(m => m.AccountPlan!.Property3 == filter.PropertyValue),
                            4 => query.Where(m => m.AccountPlan!.Property4 == filter.PropertyValue),
                            5 => query.Where(m => m.AccountPlan!.Property5 == filter.PropertyValue),
                            _ => query
                        };
                    }
                }

                if (!string.IsNullOrEmpty(item.AccountCodePrefix))
                    query = query.Where(m => m.AccountPlan!.AccountCode.StartsWith(item.AccountCodePrefix));

                var balances = await query
                    .GroupBy(m => new { m.Month })
                    .Select(g => new
                    {
                        Month = g.Key.Month,
                        DebitBalance = g.Sum(m => m.DebitBalance),
                        CreditBalance = g.Sum(m => m.CreditBalance)
                    })
                    .ToListAsync();

                var values = new Dictionary<string, decimal>();
                decimal total = 0;
                foreach (var (periodYear, periodMonth) in allPeriods)
                {
                    var balance = balances.FirstOrDefault(b => b.Month == periodMonth);
                    var netBalance = balance != null ? (balance.DebitBalance - balance.CreditBalance) : 0m;
                    var periodKey = $"{periodMonth}";
                    values[periodKey] = netBalance;
                    total += netBalance;
                }
                values["Total"] = total;

                groupData.Add(new
                {
                    item.Name,
                    item.PropertyFilters,
                    item.AccountCodePrefix,
                    Values = values
                });
            }

            var groupTotal = new Dictionary<string, decimal>();
            foreach (var (_, periodMonth) in allPeriods)
            {
                var periodKey = $"{periodMonth}";
                decimal periodSum = 0;
                foreach (var item in groupData)
                {
                    var itemDict = item.GetType().GetProperty("Values")?.GetValue(item) as Dictionary<string, decimal>;
                    if (itemDict != null && itemDict.ContainsKey(periodKey))
                        periodSum += itemDict[periodKey];
                }
                groupTotal[periodKey] = periodSum;
            }
            decimal totalSum = 0;
            foreach (var item in groupData)
            {
                var itemDict = item.GetType().GetProperty("Values")?.GetValue(item) as Dictionary<string, decimal>;
                if (itemDict != null && itemDict.ContainsKey("Total"))
                    totalSum += itemDict["Total"];
            }
            groupTotal["Total"] = totalSum;

            groups.Add(new
            {
                group.Name,
                group.DisplayOrder,
                Items = groupData,
                Total = groupTotal
            });
        }

        return Ok(new
        {
            Year = year.Value,
            Periods = allPeriodsRaw.Select(p => new { p.Year, p.Month }).ToList(),
            Groups = groups.OrderBy(g => ((dynamic)g).DisplayOrder)
        });
    }

    [HttpPost("company/{companyId}/save-config")]
    public async Task<ActionResult> SaveReportConfig(int companyId, [FromBody] GelirRaporuConfigRequest request)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();
        return Ok(new { success = true, message = "Rapor yapılandırması kaydedildi" });
    }

    [HttpGet("company/{companyId}/config")]
    public async Task<ActionResult<object>> GetReportConfig(int companyId)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();
        return Ok(new { Groups = new List<object>() });
    }

    [HttpGet("company/{companyId}/templates")]
    public async Task<ActionResult<object>> GetTemplates(int companyId)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();
        try
        {
            var userId = GetUserId();
            var templates = await _context.GelirRaporuTemplates
                .Where(t => t.CompanyId == companyId && t.UserId == userId)
                .OrderByDescending(t => t.UpdatedAt)
                .Select(t => new { t.Id, t.TemplateName, t.CreatedAt, t.UpdatedAt })
                .ToListAsync();
            return Ok(templates);
        }
        catch (Microsoft.Data.SqlClient.SqlException sqlEx)
        {
            if (sqlEx.Message.Contains("Invalid object name") || sqlEx.Message.Contains("GelirRaporuTemplates") || sqlEx.Number == 208)
                return Ok(new List<object>());
            throw;
        }
        catch (Exception ex)
        {
            if (ex.Message.Contains("Invalid object name") || ex.Message.Contains("GelirRaporuTemplates") ||
                ex.InnerException?.Message?.Contains("Invalid object name") == true ||
                ex.InnerException?.Message?.Contains("GelirRaporuTemplates") == true)
                return Ok(new List<object>());
            throw;
        }
    }

    [HttpPost("company/{companyId}/templates")]
    public async Task<ActionResult<object>> SaveTemplate(int companyId, [FromBody] GelirSaveTemplateRequest request)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();
        if (string.IsNullOrWhiteSpace(request.TemplateName))
            return BadRequest(new { message = "Şablon adı gereklidir" });
        if (request.Groups == null || request.Groups.Count == 0)
            return BadRequest(new { message = "En az bir grup gereklidir" });

        try
        {
            var userId = GetUserId();
            var existingTemplate = await _context.GelirRaporuTemplates
                .FirstOrDefaultAsync(t => t.CompanyId == companyId && t.UserId == userId && t.TemplateName == request.TemplateName);
            var groupsJson = JsonSerializer.Serialize(request.Groups);

            if (existingTemplate != null)
            {
                existingTemplate.GroupsJson = groupsJson;
                existingTemplate.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return Ok(new { Id = existingTemplate.Id, TemplateName = existingTemplate.TemplateName, Message = "Şablon güncellendi" });
            }

            var template = new GelirRaporuTemplate
            {
                CompanyId = companyId,
                UserId = userId,
                TemplateName = request.TemplateName,
                GroupsJson = groupsJson,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.GelirRaporuTemplates.Add(template);
            await _context.SaveChangesAsync();
            return Ok(new { Id = template.Id, TemplateName = template.TemplateName, Message = "Şablon kaydedildi" });
        }
        catch (Microsoft.Data.SqlClient.SqlException sqlEx)
        {
            if (sqlEx.Message.Contains("Invalid object name") || sqlEx.Message.Contains("GelirRaporuTemplates") || sqlEx.Number == 208)
                return StatusCode(500, new { message = "Şablon tablosu bulunamadı. Lütfen migration uygulayın.", details = sqlEx.Message });
            throw;
        }
        catch (Exception ex)
        {
            var errorMessage = ex.Message + (ex.InnerException != null ? " | " + ex.InnerException.Message : "");
            if (errorMessage.Contains("Invalid object name") || errorMessage.Contains("GelirRaporuTemplates") || errorMessage.Contains("does not exist"))
                return StatusCode(500, new { message = "Şablon tablosu bulunamadı. Lütfen migration uygulayın.", details = errorMessage });
            throw;
        }
    }

    [HttpGet("company/{companyId}/templates/{templateId}")]
    public async Task<ActionResult<object>> LoadTemplate(int companyId, int templateId)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();
        var userId = GetUserId();
        var template = await _context.GelirRaporuTemplates
            .FirstOrDefaultAsync(t => t.Id == templateId && t.CompanyId == companyId && t.UserId == userId);
        if (template == null)
            return NotFound(new { message = "Şablon bulunamadı" });
        try
        {
            var groups = JsonSerializer.Deserialize<List<GelirRaporuGroup>>(template.GroupsJson);
            return Ok(new { Groups = groups });
        }
        catch (JsonException)
        {
            return BadRequest(new { message = "Şablon verisi geçersiz" });
        }
    }

    [HttpDelete("company/{companyId}/templates/{templateId}")]
    public async Task<ActionResult> DeleteTemplate(int companyId, int templateId)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();
        var userId = GetUserId();
        var template = await _context.GelirRaporuTemplates
            .FirstOrDefaultAsync(t => t.Id == templateId && t.CompanyId == companyId && t.UserId == userId);
        if (template == null)
            return NotFound(new { message = "Şablon bulunamadı" });
        _context.GelirRaporuTemplates.Remove(template);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Şablon silindi" });
    }
}

public class GelirRaporuRequest
{
    public List<GelirRaporuGroup> Groups { get; set; } = new();
}

public class GelirRaporuGroup
{
    public string Name { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public List<GelirRaporuItem> Items { get; set; } = new();
}

public class GelirRaporuItem
{
    public string Name { get; set; } = string.Empty;
    public List<GelirPropertyFilter>? PropertyFilters { get; set; }
    public string? AccountCodePrefix { get; set; }
}

public class GelirPropertyFilter
{
    public int PropertyIndex { get; set; }
    public string PropertyValue { get; set; } = string.Empty;
}

public class GelirRaporuConfigRequest
{
    public List<GelirRaporuGroup> Groups { get; set; } = new();
}

public class GelirSaveTemplateRequest
{
    public string TemplateName { get; set; } = string.Empty;
    public List<GelirRaporuGroup> Groups { get; set; } = new();
}
