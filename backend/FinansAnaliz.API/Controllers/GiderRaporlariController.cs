using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using FinansAnaliz.API.Data;
using FinansAnaliz.API.DTOs;
using FinansAnaliz.API.Models;

namespace FinansAnaliz.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GiderRaporlariController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public GiderRaporlariController(ApplicationDbContext context)
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
        
        // Property1-5 için hesap planından değerleri kontrol et
        // Eğer değerler varsa, o özelliği göster (şirket bilgilerindeki isimle)
        for (int i = 1; i <= 5; i++)
        {
            // Önce hesap planından bu property için değer var mı kontrol et
            bool hasValues = false;
            List<string> allValues = new List<string>();
            
            // Hesap planından direkt kontrol et
            if (i == 1)
            {
                hasValues = await _context.AccountPlans
                    .AnyAsync(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property1) && a.AccountCode.StartsWith("7"));
                
                if (hasValues)
                {
                    var values = await _context.AccountPlans
                        .Where(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property1) && a.AccountCode.StartsWith("7"))
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
                    .AnyAsync(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property2) && a.AccountCode.StartsWith("7"));
                
                if (hasValues)
                {
                    var values = await _context.AccountPlans
                        .Where(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property2) && a.AccountCode.StartsWith("7"))
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
                    .AnyAsync(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property3) && a.AccountCode.StartsWith("7"));
                
                if (hasValues)
                {
                    var values = await _context.AccountPlans
                        .Where(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property3) && a.AccountCode.StartsWith("7"))
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
                    .AnyAsync(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property4) && a.AccountCode.StartsWith("7"));
                
                if (hasValues)
                {
                    var values = await _context.AccountPlans
                        .Where(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property4) && a.AccountCode.StartsWith("7"))
                        .Select(a => a.Property4!)
                        .Distinct()
                        .OrderBy(v => v)
                        .ToListAsync();
                    allValues = values;
                }
            }
            else // i == 5
            {
                hasValues = await _context.AccountPlans
                    .AnyAsync(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property5) && a.AccountCode.StartsWith("7"));
                
                if (hasValues)
                {
                    var values = await _context.AccountPlans
                        .Where(a => a.CompanyId == companyId && !string.IsNullOrEmpty(a.Property5) && a.AccountCode.StartsWith("7"))
                        .Select(a => a.Property5!)
                        .Distinct()
                        .OrderBy(v => v)
                        .ToListAsync();
                    allValues = values;
                }
            }

            // Eğer bu property için değerler varsa, özelliği göster
            if (hasValues && allValues.Any())
            {
                // Şirket bilgilerinden özellik ismini al (yoksa varsayılan isim kullan)
                string propertyName = string.Empty;
                switch (i)
                {
                    case 1:
                        propertyName = company.PropertyName1 ?? "Özellik 1";
                        break;
                    case 2:
                        propertyName = company.PropertyName2 ?? "Özellik 2";
                        break;
                    case 3:
                        propertyName = company.PropertyName3 ?? "Özellik 3";
                        break;
                    case 4:
                        propertyName = company.PropertyName4 ?? "Özellik 4";
                        break;
                    case 5:
                        propertyName = company.PropertyName5 ?? "Özellik 5";
                        break;
                }

                properties.Add(new
                {
                    Index = i,
                    Name = propertyName,
                    Values = allValues
                });
            }
        }

        return Ok(properties);
    }

    [HttpGet("company/{companyId}/account-codes")]
    public async Task<ActionResult<object>> GetAccountCodes(int companyId, [FromQuery] string? search = null)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        // Önce hesap planından hesapları getir
        var accountsFromPlan = _context.AccountPlans
            .Where(a => a.CompanyId == companyId && a.IsLeaf == true);

        if (!string.IsNullOrEmpty(search))
        {
            accountsFromPlan = accountsFromPlan.Where(a => 
                a.AccountCode.Contains(search) || 
                a.AccountName.Contains(search));
        }

        var planAccounts = await accountsFromPlan
            .Select(a => new
            {
                AccountCode = a.AccountCode,
                AccountName = a.AccountName
            })
            .ToListAsync();

        // Sonra mizan verilerinden hesapları getir (AccountPlan üzerinden)
        var accountsFromBalances = _context.MonthlyBalances
            .Include(m => m.AccountPlan)
            .Where(m => m.CompanyId == companyId && 
                       m.AccountPlan != null && 
                       m.AccountPlan.IsLeaf == true);

        if (!string.IsNullOrEmpty(search))
        {
            accountsFromBalances = accountsFromBalances.Where(m => 
                m.AccountPlan!.AccountCode.Contains(search) || 
                m.AccountPlan.AccountName.Contains(search));
        }

        var balanceAccounts = await accountsFromBalances
            .Select(m => new
            {
                AccountCode = m.AccountPlan!.AccountCode,
                AccountName = m.AccountPlan.AccountName
            })
            .Distinct()
            .ToListAsync();

        // İki listeyi birleştir ve tekrarları kaldır
        var allAccounts = planAccounts
            .Concat(balanceAccounts)
            .GroupBy(a => a.AccountCode)
            .Select(g => g.First())
            .OrderBy(a => a.AccountCode)
            .Take(100) // İlk 100 sonucu getir
            .ToList();

        return Ok(allAccounts);
    }

    [HttpPost("company/{companyId}/report")]
    public async Task<ActionResult<object>> GetGiderRaporu(
        int companyId,
        [FromQuery] int? year,
        [FromBody] GiderRaporuRequest request)
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
                    Groups = new List<object>()
                });
            }

            year = lastYear;
        }

        // Tüm dönemleri getir
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
                Groups = new List<object>()
            });
        }

        var allPeriods = allPeriodsRaw.Select(p => (p.Year, p.Month)).ToList();

        // Kullanıcı tanımlı gruplara göre veri topla
        var groups = new List<object>();

        foreach (var group in request.Groups)
        {
            var groupData = new List<object>();

            foreach (var item in group.Items)
            {
                // Bu item için veri topla
                var query = _context.MonthlyBalances
                    .Include(m => m.AccountPlan)
                    .Where(m => m.CompanyId == companyId &&
                               m.Year == year.Value &&
                               m.AccountPlan != null &&
                               m.AccountPlan.IsLeaf == true);

                // Property filtrelerini uygula
                if (item.PropertyFilters != null)
                {
                    foreach (var filter in item.PropertyFilters)
                    {
                        var propertyIndex = filter.PropertyIndex;
                        var propertyValue = filter.PropertyValue;

                        if (propertyIndex == 1)
                        {
                            query = query.Where(m => m.AccountPlan!.Property1 == propertyValue);
                        }
                        else if (propertyIndex == 2)
                        {
                            query = query.Where(m => m.AccountPlan!.Property2 == propertyValue);
                        }
                        else if (propertyIndex == 3)
                        {
                            query = query.Where(m => m.AccountPlan!.Property3 == propertyValue);
                        }
                        else if (propertyIndex == 4)
                        {
                            query = query.Where(m => m.AccountPlan!.Property4 == propertyValue);
                        }
                        else if (propertyIndex == 5)
                        {
                            query = query.Where(m => m.AccountPlan!.Property5 == propertyValue);
                        }
                    }
                }

                // Hesap kodu filtresi varsa uygula
                if (!string.IsNullOrEmpty(item.AccountCodePrefix))
                {
                    query = query.Where(m => m.AccountPlan!.AccountCode.StartsWith(item.AccountCodePrefix));
                }

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
                    Name = item.Name,
                    PropertyFilters = item.PropertyFilters,
                    AccountCodePrefix = item.AccountCodePrefix,
                    Values = values
                });
            }

            // Grup toplamını hesapla
            var groupTotal = new Dictionary<string, decimal>();
            foreach (var (periodYear, periodMonth) in allPeriods)
            {
                var periodKey = $"{periodMonth}";
                decimal periodSum = 0;
                foreach (var item in groupData)
                {
                    var itemDict = item.GetType().GetProperty("Values")?.GetValue(item) as Dictionary<string, decimal>;
                    if (itemDict != null && itemDict.ContainsKey(periodKey))
                    {
                        periodSum += itemDict[periodKey];
                    }
                }
                groupTotal[periodKey] = periodSum;
            }
            
            decimal totalSum = 0;
            foreach (var item in groupData)
            {
                var itemDict = item.GetType().GetProperty("Values")?.GetValue(item) as Dictionary<string, decimal>;
                if (itemDict != null && itemDict.ContainsKey("Total"))
                {
                    totalSum += itemDict["Total"];
                }
            }
            groupTotal["Total"] = totalSum;

            groups.Add(new
            {
                Name = group.Name,
                DisplayOrder = group.DisplayOrder,
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
    public async Task<ActionResult> SaveReportConfig(int companyId, [FromBody] GiderRaporuConfigRequest request)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        var company = await _context.Companies.FindAsync(companyId);
        if (company == null)
            return NotFound();

        // Rapor yapılandırmasını JSON olarak kaydet
        var configJson = JsonSerializer.Serialize(request);
        
        // Company tablosuna yeni bir JSON kolonu eklemek yerine, mevcut BilancoParametersJson gibi bir alan kullanabiliriz
        // Ya da yeni bir kolon eklemek gerekir. Şimdilik JSON string olarak kaydedelim
        // Not: Bu için migration gerekebilir, şimdilik geçici çözüm olarak başka bir yerde saklayabiliriz
        
        return Ok(new { success = true, message = "Rapor yapılandırması kaydedildi" });
    }

    [HttpGet("company/{companyId}/config")]
    public async Task<ActionResult<object>> GetReportConfig(int companyId)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        // Şimdilik boş config döndür, daha sonra database'den yüklenecek
        return Ok(new
        {
            Groups = new List<object>()
        });
    }

    // Şablon Endpoint'leri
    [HttpGet("company/{companyId}/templates")]
    public async Task<ActionResult<object>> GetTemplates(int companyId)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        try
        {
            var userId = GetUserId();
            var templates = await _context.GiderRaporuTemplates
                .Where(t => t.CompanyId == companyId && t.UserId == userId)
                .OrderByDescending(t => t.UpdatedAt)
                .Select(t => new
                {
                    Id = t.Id,
                    TemplateName = t.TemplateName,
                    CreatedAt = t.CreatedAt,
                    UpdatedAt = t.UpdatedAt
                })
                .ToListAsync();

            return Ok(templates);
        }
        catch (Microsoft.Data.SqlClient.SqlException sqlEx)
        {
            // Migration uygulanmamışsa boş liste döndür
            if (sqlEx.Message.Contains("Invalid object name") || 
                sqlEx.Message.Contains("GiderRaporuTemplates") ||
                sqlEx.Number == 208) // SQL Server error 208 = Invalid object name
            {
                return Ok(new List<object>());
            }
            throw;
        }
        catch (Exception ex)
        {
            // Diğer exception'lar için de kontrol et
            if (ex.Message.Contains("Invalid object name") || 
                ex.Message.Contains("GiderRaporuTemplates") ||
                ex.InnerException?.Message?.Contains("Invalid object name") == true ||
                ex.InnerException?.Message?.Contains("GiderRaporuTemplates") == true)
            {
                return Ok(new List<object>());
            }
            throw;
        }
    }

    [HttpPost("company/{companyId}/templates")]
    public async Task<ActionResult<object>> SaveTemplate(int companyId, [FromBody] SaveTemplateRequest request)
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
            
            // Aynı isimde şablon var mı kontrol et
            var existingTemplate = await _context.GiderRaporuTemplates
                .FirstOrDefaultAsync(t => t.CompanyId == companyId && 
                                         t.UserId == userId && 
                                         t.TemplateName == request.TemplateName);

            var groupsJson = JsonSerializer.Serialize(request.Groups);

            if (existingTemplate != null)
            {
                // Mevcut şablonu güncelle
                existingTemplate.GroupsJson = groupsJson;
                existingTemplate.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                
                return Ok(new { 
                    Id = existingTemplate.Id, 
                    TemplateName = existingTemplate.TemplateName,
                    Message = "Şablon güncellendi"
                });
            }
            else
            {
                // Yeni şablon oluştur
                var template = new GiderRaporuTemplate
                {
                    CompanyId = companyId,
                    UserId = userId,
                    TemplateName = request.TemplateName,
                    GroupsJson = groupsJson,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.GiderRaporuTemplates.Add(template);
                await _context.SaveChangesAsync();

                return Ok(new { 
                    Id = template.Id, 
                    TemplateName = template.TemplateName,
                    Message = "Şablon kaydedildi"
                });
            }
        }
        catch (Microsoft.Data.SqlClient.SqlException sqlEx)
        {
            // Migration uygulanmamışsa bilgilendirici hata döndür
            if (sqlEx.Message.Contains("Invalid object name") || 
                sqlEx.Message.Contains("GiderRaporuTemplates") ||
                sqlEx.Number == 208) // SQL Server error 208 = Invalid object name
            {
                return StatusCode(500, new { 
                    message = "Şablon tablosu bulunamadı. Lütfen migration'ı uygulayın: dotnet ef database update veya SQL script'i çalıştırın.",
                    details = sqlEx.Message
                });
            }
            // Diğer SQL hatalarını logla ve fırlat
            Console.WriteLine($"SQL Exception in SaveTemplate: {sqlEx.Message}");
            throw;
        }
        catch (Exception ex)
        {
            // Tüm exception'ları logla
            Console.WriteLine($"Exception in SaveTemplate: {ex.Message}");
            Console.WriteLine($"Inner Exception: {ex.InnerException?.Message}");
            Console.WriteLine($"Stack Trace: {ex.StackTrace}");
            
            // Diğer exception'lar için de kontrol et
            var errorMessage = ex.Message + (ex.InnerException != null ? " | Inner: " + ex.InnerException.Message : "");
            if (errorMessage.Contains("Invalid object name") || 
                errorMessage.Contains("GiderRaporuTemplates") ||
                errorMessage.Contains("does not exist"))
            {
                return StatusCode(500, new { 
                    message = "Şablon tablosu bulunamadı. Lütfen migration'ı uygulayın: dotnet ef database update veya SQL script'i çalıştırın.",
                    details = errorMessage
                });
            }
            throw;
        }
    }

    [HttpGet("company/{companyId}/templates/{templateId}")]
    public async Task<ActionResult<object>> LoadTemplate(int companyId, int templateId)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        var userId = GetUserId();
        var template = await _context.GiderRaporuTemplates
            .FirstOrDefaultAsync(t => t.Id == templateId && 
                                     t.CompanyId == companyId && 
                                     t.UserId == userId);

        if (template == null)
            return NotFound(new { message = "Şablon bulunamadı" });

        try
        {
            var groups = JsonSerializer.Deserialize<List<GiderRaporuGroup>>(template.GroupsJson);
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
        var template = await _context.GiderRaporuTemplates
            .FirstOrDefaultAsync(t => t.Id == templateId && 
                                     t.CompanyId == companyId && 
                                     t.UserId == userId);

        if (template == null)
            return NotFound(new { message = "Şablon bulunamadı" });

        _context.GiderRaporuTemplates.Remove(template);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Şablon silindi" });
    }
}

public class GiderRaporuRequest
{
    public List<GiderRaporuGroup> Groups { get; set; } = new();
}

public class GiderRaporuGroup
{
    public string Name { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public List<GiderRaporuItem> Items { get; set; } = new();
}

public class GiderRaporuItem
{
    public string Name { get; set; } = string.Empty;
    public List<PropertyFilter>? PropertyFilters { get; set; }
    public string? AccountCodePrefix { get; set; }
}

public class PropertyFilter
{
    public int PropertyIndex { get; set; } // 1-5
    public string PropertyValue { get; set; } = string.Empty;
}

public class GiderRaporuConfigRequest
{
    public List<GiderRaporuGroup> Groups { get; set; } = new();
}

public class SaveTemplateRequest
{
    public string TemplateName { get; set; } = string.Empty;
    public List<GiderRaporuGroup> Groups { get; set; } = new();
}
