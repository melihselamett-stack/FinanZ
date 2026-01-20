using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using FinansAnaliz.API.Data;
using FinansAnaliz.API.DTOs;

namespace FinansAnaliz.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BilancoParameterController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public BilancoParameterController(ApplicationDbContext context)
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
    public async Task<ActionResult<object>> GetParameters(int companyId)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        var company = await _context.Companies.FindAsync(companyId);
        if (company == null)
            return NotFound();

        // JSON'dan parametreleri parse et
        if (string.IsNullOrEmpty(company.BilancoParametersJson))
        {
            // Varsayılan parametreleri döndür
            return Ok(GetDefaultParameters());
        }

        try
        {
            var parameters = JsonSerializer.Deserialize<List<BilancoParameterDto>>(company.BilancoParametersJson);
            return Ok(parameters ?? GetDefaultParameters());
        }
        catch
        {
            return Ok(GetDefaultParameters());
        }
    }

    [HttpPut("company/{companyId}")]
    public async Task<ActionResult> UpdateParameters(int companyId, [FromBody] List<BilancoParameterDto> parameters)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        var company = await _context.Companies.FindAsync(companyId);
        if (company == null)
            return NotFound();

        // Parametreleri JSON'a çevir ve kaydet
        company.BilancoParametersJson = JsonSerializer.Serialize(parameters);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Parametreler güncellendi" });
    }

    [HttpGet("company/{companyId}/report-rows")]
    public async Task<ActionResult<object>> GetReportRows(int companyId, [FromQuery] int? year = null)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        var company = await _context.Companies.FindAsync(companyId);
        if (company == null)
            return NotFound();

        // Yıl belirtilmemişse, en son yılı kullan
        if (!year.HasValue)
        {
            var lastYear = await _context.MonthlyBalances
                .Where(m => m.CompanyId == companyId)
                .OrderByDescending(m => m.Year)
                .Select(m => m.Year)
                .FirstOrDefaultAsync();
            
            if (lastYear == 0)
                return Ok(new { Varliklar = new List<object>(), Kaynaklar = new List<object>() });
            
            year = lastYear;
        }

        // Tüm hesap kodlarını al (leaf hesaplar)
        var allAccountCodes = await _context.MonthlyBalances
            .Include(m => m.AccountPlan)
            .Where(m => m.CompanyId == companyId && 
                       m.Year == year.Value &&
                       m.AccountPlan != null &&
                       m.AccountPlan.IsLeaf == true)
            .Select(m => m.AccountPlan!.AccountCode)
            .Distinct()
            .ToListAsync();

        // Eğer hesap kodu yoksa, boş liste döndür
        if (!allAccountCodes.Any())
        {
            return Ok(new
            {
                Year = year.Value,
                Varliklar = new List<object>(),
                Kaynaklar = new List<object>(),
                Message = $"Bu yıl ({year.Value}) için mizan verisi bulunamadı veya leaf hesap bulunamadı."
            });
        }

        // Custom parametreleri al
        var customParams = new List<BilancoParameterDto>();
        if (!string.IsNullOrEmpty(company.BilancoParametersJson))
        {
            try
            {
                customParams = System.Text.Json.JsonSerializer.Deserialize<List<BilancoParameterDto>>(company.BilancoParametersJson) ?? new List<BilancoParameterDto>();
            }
            catch
            {
                customParams = new List<BilancoParameterDto>();
            }
        }

        // VARLIKLAR bölümü için satırları oluştur
        var varliklarRows = new List<object>();
        var processedL1Codes = new HashSet<string>(); // İşlenmiş L1 kodlarını takip et
        
        // DÖNEN VARLIKLAR (1 ile başlayan)
        var donenAccountCodes = allAccountCodes.Where(c => c.StartsWith("1")).ToList();
        var donenL1Groups = donenAccountCodes
            .GroupBy(code =>
            {
                var parts = code.Split('.');
                var firstPart = parts.Length > 0 ? parts[0] : code;
                return firstPart.Length >= 2 ? firstPart.Substring(0, 2) : firstPart;
            })
            .ToList();

        foreach (var l1Group in donenL1Groups.OrderBy(g => g.Key))
        {
            var l1Code = l1Group.Key;
            processedL1Codes.Add($"1-{l1Code}"); // İşlendi olarak işaretle
            var rowInfo = await GetRowInfoForL1Code(companyId, l1Code, "1", l1Group.ToList());
            if (rowInfo != null && !string.IsNullOrEmpty(rowInfo.Name))
            {
                varliklarRows.Add(new
                {
                    NotCode = rowInfo.NotCode,
                    AccountName = rowInfo.Name,
                    Section = "Varliklar",
                    SubSection = "DÖNEN VARLIKLAR",
                    AccountCodes = rowInfo.AccountCodes ?? new List<string>(),
                    AccountCodePrefixes = ExtractPrefixesFromCodes(rowInfo.AccountCodes ?? new List<string>())
                });
            }
        }

        // DURAN VARLIKLAR (2 ile başlayan)
        var duranAccountCodes = allAccountCodes.Where(c => c.StartsWith("2")).ToList();
        var duranL1Groups = duranAccountCodes
            .GroupBy(code =>
            {
                var parts = code.Split('.');
                var firstPart = parts.Length > 0 ? parts[0] : code;
                return firstPart.Length >= 2 ? firstPart.Substring(0, 2) : firstPart;
            })
            .ToList();

        foreach (var l1Group in duranL1Groups.OrderBy(g => g.Key))
        {
            var l1Code = l1Group.Key;
            processedL1Codes.Add($"2-{l1Code}"); // İşlendi olarak işaretle
            var rowInfo = await GetRowInfoForL1Code(companyId, l1Code, "2", l1Group.ToList());
            if (rowInfo != null && !string.IsNullOrEmpty(rowInfo.Name))
            {
                varliklarRows.Add(new
                {
                    NotCode = rowInfo.NotCode,
                    AccountName = rowInfo.Name,
                    Section = "Varliklar",
                    SubSection = "DURAN VARLIKLAR",
                    AccountCodes = rowInfo.AccountCodes ?? new List<string>(),
                    AccountCodePrefixes = ExtractPrefixesFromCodes(rowInfo.AccountCodes ?? new List<string>())
                });
            }
        }

        // Custom parametreleri kontrol et - eğer işlenmemişse ekle
        var varliklarCustomParams = customParams.Where(p => p.Section == "Varliklar").ToList();
        foreach (var customParam in varliklarCustomParams)
        {
            // NOT kodunun ilk karakterine göre veya AccountCodePrefixes'in ilk karakterine göre section belirle
            string mainPrefix;
            string subSection;
            
            if (customParam.AccountCodePrefixes != null && customParam.AccountCodePrefixes.Any())
            {
                var firstPrefix = customParam.AccountCodePrefixes.First();
                mainPrefix = firstPrefix.StartsWith("1") ? "1" : firstPrefix.StartsWith("2") ? "2" : 
                            customParam.NotCode.StartsWith("1") ? "1" : "2";
            }
            else
            {
                mainPrefix = customParam.NotCode.StartsWith("1") ? "1" : "2";
            }
            
            subSection = mainPrefix == "1" ? "DÖNEN VARLIKLAR" : "DURAN VARLIKLAR";
            var key = $"{mainPrefix}-{customParam.NotCode}";
            
            if (!processedL1Codes.Contains(key))
            {
                // Bu custom parametre henüz işlenmemiş, ekle
                
                // Hesap kodlarını filtrele
                var relevantAccountCodes = allAccountCodes.Where(code =>
                {
                    if (customParam.AccountCodePrefixes != null && customParam.AccountCodePrefixes.Any())
                    {
                        var codeParts = code.Split('.');
                        var firstPart = codeParts.Length > 0 ? codeParts[0] : code;
                        return customParam.AccountCodePrefixes.Any(prefix => firstPart.StartsWith(prefix));
                    }
                    else
                    {
                        var codeParts = code.Split('.');
                        var firstPart = codeParts.Length > 0 ? codeParts[0] : code;
                        return firstPart.StartsWith(mainPrefix) && 
                               (customParam.NotCode.Length >= 2 && firstPart.Length >= 2 ? 
                                firstPart.Substring(0, 2) == customParam.NotCode : 
                                firstPart.StartsWith(customParam.NotCode));
                    }
                }).ToList();

                varliklarRows.Add(new
                {
                    NotCode = customParam.NotCode,
                    AccountName = customParam.AccountName,
                    Section = "Varliklar",
                    SubSection = subSection,
                    AccountCodes = relevantAccountCodes,
                    AccountCodePrefixes = customParam.AccountCodePrefixes ?? ExtractPrefixesFromCodes(relevantAccountCodes)
                });
            }
        }

        // KAYNAKLAR bölümü için satırları oluştur
        var kaynaklarRows = new List<object>();
        var processedKaynaklarL1Codes = new HashSet<string>(); // İşlenmiş L1 kodlarını takip et

        // CURRENT LIABILITIES (3 ile başlayan)
        var kisaVadeliAccountCodes = allAccountCodes.Where(c => c.StartsWith("3")).ToList();
        var kisaVadeliL1Groups = kisaVadeliAccountCodes
            .GroupBy(code =>
            {
                var parts = code.Split('.');
                var firstPart = parts.Length > 0 ? parts[0] : code;
                return firstPart.Length >= 2 ? firstPart.Substring(0, 2) : firstPart;
            })
            .ToList();

        foreach (var l1Group in kisaVadeliL1Groups.OrderBy(g => g.Key))
        {
            var l1Code = l1Group.Key;
            processedKaynaklarL1Codes.Add($"3-{l1Code}"); // İşlendi olarak işaretle
            var rowInfo = await GetRowInfoForL1Code(companyId, l1Code, "3", l1Group.ToList());
            if (rowInfo != null && !string.IsNullOrEmpty(rowInfo.Name))
            {
                kaynaklarRows.Add(new
                {
                    NotCode = rowInfo.NotCode,
                    AccountName = rowInfo.Name,
                    Section = "Kaynaklar",
                    SubSection = "CURRENT LIABILITIES",
                    AccountCodes = rowInfo.AccountCodes ?? new List<string>(),
                    AccountCodePrefixes = ExtractPrefixesFromCodes(rowInfo.AccountCodes ?? new List<string>())
                });
            }
        }

        // UZUN VADELİ KAYNAKLAR (4 ile başlayan)
        var uzunVadeliAccountCodes = allAccountCodes.Where(c => c.StartsWith("4")).ToList();
        var uzunVadeliL1Groups = uzunVadeliAccountCodes
            .GroupBy(code =>
            {
                var parts = code.Split('.');
                var firstPart = parts.Length > 0 ? parts[0] : code;
                return firstPart.Length >= 2 ? firstPart.Substring(0, 2) : firstPart;
            })
            .ToList();

        foreach (var l1Group in uzunVadeliL1Groups.OrderBy(g => g.Key))
        {
            var l1Code = l1Group.Key;
            processedKaynaklarL1Codes.Add($"4-{l1Code}"); // İşlendi olarak işaretle
            var rowInfo = await GetRowInfoForL1Code(companyId, l1Code, "4", l1Group.ToList());
            if (rowInfo != null && !string.IsNullOrEmpty(rowInfo.Name))
            {
                kaynaklarRows.Add(new
                {
                    NotCode = rowInfo.NotCode,
                    AccountName = rowInfo.Name,
                    Section = "Kaynaklar",
                    SubSection = "UZUN VADELİ KAYNAKLAR",
                    AccountCodes = rowInfo.AccountCodes ?? new List<string>(),
                    AccountCodePrefixes = ExtractPrefixesFromCodes(rowInfo.AccountCodes ?? new List<string>())
                });
            }
        }

        // ÖZKAYNAKLAR (5 ile başlayan)
        var ozkaynakAccountCodes = allAccountCodes.Where(c => c.StartsWith("5")).ToList();
        var ozkaynakL1Groups = ozkaynakAccountCodes
            .GroupBy(code =>
            {
                var parts = code.Split('.');
                var firstPart = parts.Length > 0 ? parts[0] : code;
                return firstPart.Length >= 2 ? firstPart.Substring(0, 2) : firstPart;
            })
            .ToList();

        foreach (var l1Group in ozkaynakL1Groups.OrderBy(g => g.Key))
        {
            var l1Code = l1Group.Key;
            processedKaynaklarL1Codes.Add($"5-{l1Code}"); // İşlendi olarak işaretle
            var rowInfo = await GetRowInfoForL1Code(companyId, l1Code, "5", l1Group.ToList());
            if (rowInfo != null && !string.IsNullOrEmpty(rowInfo.Name))
            {
                kaynaklarRows.Add(new
                {
                    NotCode = rowInfo.NotCode,
                    AccountName = rowInfo.Name,
                    Section = "Kaynaklar",
                    SubSection = "ÖZKAYNAKLAR",
                    AccountCodes = rowInfo.AccountCodes ?? new List<string>(),
                    AccountCodePrefixes = ExtractPrefixesFromCodes(rowInfo.AccountCodes ?? new List<string>())
                });
            }
        }

        // Custom parametreleri kontrol et - eğer işlenmemişse ekle
        var kaynaklarCustomParams = customParams.Where(p => p.Section == "Kaynaklar").ToList();
        foreach (var customParam in kaynaklarCustomParams)
        {
            var key = customParam.NotCode.StartsWith("3") ? $"3-{customParam.NotCode}" : 
                      customParam.NotCode.StartsWith("4") ? $"4-{customParam.NotCode}" :
                      customParam.NotCode.StartsWith("5") ? $"5-{customParam.NotCode}" : null;
            
            if (key != null && !processedKaynaklarL1Codes.Contains(key))
            {
                // Bu custom parametre henüz işlenmemiş, ekle
                string mainPrefix;
                string subSection;
                if (customParam.NotCode.StartsWith("3"))
                {
                    mainPrefix = "3";
                    subSection = "CURRENT LIABILITIES";
                }
                else if (customParam.NotCode.StartsWith("4"))
                {
                    mainPrefix = "4";
                    subSection = "UZUN VADELİ KAYNAKLAR";
                }
                else
                {
                    mainPrefix = "5";
                    subSection = "ÖZKAYNAKLAR";
                }
                
                // Hesap kodlarını filtrele
                var relevantAccountCodes = allAccountCodes.Where(code =>
                {
                    if (customParam.AccountCodePrefixes != null && customParam.AccountCodePrefixes.Any())
                    {
                        var codeParts = code.Split('.');
                        var firstPart = codeParts.Length > 0 ? codeParts[0] : code;
                        return customParam.AccountCodePrefixes.Any(prefix => firstPart.StartsWith(prefix));
                    }
                    else
                    {
                        var codeParts = code.Split('.');
                        var firstPart = codeParts.Length > 0 ? codeParts[0] : code;
                        return firstPart.StartsWith(mainPrefix) && 
                               (customParam.NotCode.Length >= 2 && firstPart.Length >= 2 ? 
                                firstPart.Substring(0, 2) == customParam.NotCode : 
                                firstPart.StartsWith(customParam.NotCode));
                    }
                }).ToList();

                kaynaklarRows.Add(new
                {
                    NotCode = customParam.NotCode,
                    AccountName = customParam.AccountName,
                    Section = "Kaynaklar",
                    SubSection = subSection,
                    AccountCodes = relevantAccountCodes,
                    AccountCodePrefixes = customParam.AccountCodePrefixes ?? ExtractPrefixesFromCodes(relevantAccountCodes)
                });
            }
        }

        return Ok(new
        {
            Year = year.Value,
            Varliklar = varliklarRows,
            Kaynaklar = kaynaklarRows
        });
    }

    private async Task<RowInfo?> GetRowInfoForL1Code(int companyId, string l1Code, string mainPrefix, List<string> allAccountCodes)
    {
        var company = await _context.Companies.FindAsync(companyId);
        if (company == null) return null;

        // Custom parametreleri kontrol et
        if (!string.IsNullOrEmpty(company.BilancoParametersJson))
        {
            try
            {
                var customParams = System.Text.Json.JsonSerializer.Deserialize<List<BilancoParameterDto>>(company.BilancoParametersJson);
                if (customParams != null)
                {
                    var section = mainPrefix == "1" || mainPrefix == "2" ? "Varliklar" : "Kaynaklar";
                    var customParam = customParams.FirstOrDefault(p => p.NotCode == l1Code && p.Section == section);
                    
                    if (customParam != null)
                    {
                        List<string> filteredCodes;
                        
                        if (customParam.AccountCodePrefixes != null && customParam.AccountCodePrefixes.Any())
                        {
                            filteredCodes = allAccountCodes.Where(code =>
                            {
                                var codeParts = code.Split('.');
                                var firstPart = codeParts.Length > 0 ? codeParts[0] : code;
                                
                                return customParam.AccountCodePrefixes.Any(prefix =>
                                {
                                    if (firstPart.StartsWith(prefix))
                                    {
                                        if (prefix.Length == 2 && firstPart.Length >= 2)
                                        {
                                            return firstPart.Substring(0, 2) == prefix;
                                        }
                                        if (prefix.Length == 3 && firstPart.Length >= 3)
                                        {
                                            return firstPart.Substring(0, 3) == prefix;
                                        }
                                        return firstPart.StartsWith(prefix);
                                    }
                                    return false;
                                });
                            }).ToList();
                        }
                        else
                        {
                            filteredCodes = allAccountCodes.Where(code =>
                            {
                                var codeParts = code.Split('.');
                                var firstPart = codeParts.Length > 0 ? codeParts[0] : code;
                                
                                if (l1Code.Length >= 2 && firstPart.Length >= 2)
                                {
                                    return firstPart.Substring(0, 2) == l1Code;
                                }
                                return firstPart.StartsWith(l1Code);
                            }).ToList();
                            
                            if (!filteredCodes.Any())
                            {
                                filteredCodes = allAccountCodes;
                            }
                        }

                        return new RowInfo
                        {
                            Name = customParam.AccountName,
                            NotCode = l1Code,
                            AccountCodes = filteredCodes
                        };
                    }
                }
            }
            catch
            {
                // JSON parse hatası
            }
        }

        // Varsayılan mapping'i kullan
        var rowName = GetDefaultRowName(l1Code, mainPrefix);
        if (string.IsNullOrEmpty(rowName))
        {
            // Eğer mapping'de yoksa, L1 kodunu hesap adı olarak kullan
            rowName = $"NOT {l1Code}";
        }

        return new RowInfo
        {
            Name = rowName,
            NotCode = l1Code,
            AccountCodes = allAccountCodes ?? new List<string>()
        };
    }

    private string GetDefaultRowName(string l1Code, string mainPrefix)
    {
        // BilancoController'daki GetRowNameByL1Code mantığını buraya taşı
        var mapping = new Dictionary<string, Dictionary<string, string>>
        {
            ["2"] = new Dictionary<string, string>
            {
                ["22"] = "Uzun Vadeli Alacaklar",
                ["23"] = "Diğer Uzun Vadeli Alacaklar",
                ["24"] = "Uzun Vadeli Finansal Yatırımlar",
                ["25"] = "Maddi Duran Varlıklar",
                ["26"] = "Maddi Olmayan Duran Varlıklar",
                ["27"] = "Tükenmeye Tabi Varlıklar",
                ["28"] = "Peşin Ödenmiş Giderler",
                ["29"] = "Ertelenmiş Vergiler"
            },
            ["1"] = new Dictionary<string, string>
            {
                ["10"] = "Nakit Ve Nakit Benzerleri",
                ["11"] = "Menkul Kıymetler",
                ["12"] = "Ticari Alacaklar",
                ["13"] = "Diğer Alacaklar",
                ["15"] = "Stoklar",
                ["17"] = "Yapılmakta Olan Yatırımlar (İnşaat)",
                ["18"] = "Peşin Ödenmiş Giderler",
                ["19"] = "Diğer Dönen Varlıklar"
            },
            ["5"] = new Dictionary<string, string>
            {
                ["50"] = "Ödenmiş Sermaye",
                ["52"] = "Sermaye Yedekleri",
                ["54"] = "Kâr Yedekleri",
                ["58"] = "Özel Fonlar"
            },
            ["4"] = new Dictionary<string, string>
            {
                ["40"] = "Mali Borçlanmalar",
                ["42"] = "Ticari Borçlar",
                ["43"] = "Diğer Borçlar",
                ["44"] = "Alınan Avanslar",
                ["47"] = "Karşılıklar",
                ["48"] = "Diğer Karşılıklar"
            },
            ["3"] = new Dictionary<string, string>
            {
                ["30"] = "Mali Borçlanmalar",
                ["32"] = "Ticari Borçlar",
                ["33"] = "Diğer Borçlar",
                ["34"] = "Alınan Avanslar",
                ["35"] = "Yıllara Yaygın İnşaat Onarım Hakedişleri",
                ["36"] = "Ödenecek Vergi Ve Fonlar",
                ["37"] = "Karşılıklar",
                ["38"] = "Ertelenmiş Gelirler",
                ["39"] = "Diğer Yükümlülükler"
            }
        };

        if (mapping.ContainsKey(mainPrefix) && mapping[mainPrefix].ContainsKey(l1Code))
        {
            return mapping[mainPrefix][l1Code];
        }

        return string.Empty;
    }

    private List<string> ExtractPrefixesFromCodes(List<string> accountCodes)
    {
        var prefixes = new HashSet<string>();
        foreach (var code in accountCodes)
        {
            var parts = code.Split('.');
            var firstPart = parts.Length > 0 ? parts[0] : code;
            
            // İlk 2 ve 3 haneli prefix'leri ekle
            if (firstPart.Length >= 2)
            {
                prefixes.Add(firstPart.Substring(0, 2));
            }
            if (firstPart.Length >= 3)
            {
                prefixes.Add(firstPart.Substring(0, 3));
            }
        }
        return prefixes.OrderBy(p => p).ToList();
    }

    private class RowInfo
    {
        public string Name { get; set; } = string.Empty;
        public string NotCode { get; set; } = string.Empty;
        public List<string> AccountCodes { get; set; } = new List<string>();
    }

    [HttpPost("company/{companyId}/reset")]
    public async Task<ActionResult> ResetToDefaults(int companyId)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        var company = await _context.Companies.FindAsync(companyId);
        if (company == null)
            return NotFound();

        // Varsayılan parametrelere sıfırla
        company.BilancoParametersJson = JsonSerializer.Serialize(GetDefaultParameters());
        await _context.SaveChangesAsync();

        return Ok(new { message = "Parametreler varsayılan değerlere sıfırlandı" });
    }

    private List<BilancoParameterDto> GetDefaultParameters()
    {
        return new List<BilancoParameterDto>
        {
            // VARLIKLAR - DURAN VARLIKLAR
            new() { NotCode = "22", Section = "Varliklar", AccountName = "Uzun Vadeli Alacaklar", DisplayOrder = 1, AccountCodePrefixes = new List<string> { "22" } },
            new() { NotCode = "23", Section = "Varliklar", AccountName = "Diğer Uzun Vadeli Alacaklar", DisplayOrder = 2, AccountCodePrefixes = new List<string> { "23" } },
            new() { NotCode = "24", Section = "Varliklar", AccountName = "Uzun Vadeli Finansal Yatırımlar", DisplayOrder = 3, AccountCodePrefixes = new List<string> { "24" } },
            new() { NotCode = "25", Section = "Varliklar", AccountName = "Maddi Duran Varlıklar", DisplayOrder = 4, AccountCodePrefixes = new List<string> { "25" } },
            new() { NotCode = "26", Section = "Varliklar", AccountName = "Maddi Olmayan Duran Varlıklar", DisplayOrder = 5, AccountCodePrefixes = new List<string> { "26" } },
            new() { NotCode = "27", Section = "Varliklar", AccountName = "Tükenmeye Tabi Varlıklar", DisplayOrder = 6, AccountCodePrefixes = new List<string> { "27" } },
            new() { NotCode = "28", Section = "Varliklar", AccountName = "Peşin Ödenmiş Giderler", DisplayOrder = 7, AccountCodePrefixes = new List<string> { "28" } },
            new() { NotCode = "29", Section = "Varliklar", AccountName = "Ertelenmiş Vergiler", DisplayOrder = 8, AccountCodePrefixes = new List<string> { "29" } },
            
            // VARLIKLAR - DÖNEN VARLIKLAR
            new() { NotCode = "10", Section = "Varliklar", AccountName = "Nakit Ve Nakit Benzerleri", DisplayOrder = 9, AccountCodePrefixes = new List<string> { "10" } },
            new() { NotCode = "11", Section = "Varliklar", AccountName = "Menkul Kıymetler", DisplayOrder = 10, AccountCodePrefixes = new List<string> { "11" } },
            new() { NotCode = "12", Section = "Varliklar", AccountName = "Ticari Alacaklar", DisplayOrder = 11, AccountCodePrefixes = new List<string> { "12" } },
            new() { NotCode = "13", Section = "Varliklar", AccountName = "Diğer Alacaklar", DisplayOrder = 12, AccountCodePrefixes = new List<string> { "13" } },
            new() { NotCode = "15", Section = "Varliklar", AccountName = "Stoklar", DisplayOrder = 14, AccountCodePrefixes = new List<string> { "15" } },
            new() { NotCode = "16", Section = "Varliklar", AccountName = "Kısa Vadeli Finansal Kiralamalar", DisplayOrder = 15, AccountCodePrefixes = new List<string> { "16" } },
            new() { NotCode = "17", Section = "Varliklar", AccountName = "Yapılmakta Olan Yatırımlar (İnşaat)", DisplayOrder = 16, AccountCodePrefixes = new List<string> { "17" } },
            new() { NotCode = "18", Section = "Varliklar", AccountName = "Peşin Ödenmiş Giderler", DisplayOrder = 17, AccountCodePrefixes = new List<string> { "18" } },
            new() { NotCode = "19", Section = "Varliklar", AccountName = "Diğer Dönen Varlıklar", DisplayOrder = 18, AccountCodePrefixes = new List<string> { "19" } },
            
            // KAYNAKLAR - ÖZKAYNAKLAR
            new() { NotCode = "50", Section = "Kaynaklar", AccountName = "Ödenmiş Sermaye", DisplayOrder = 1, AccountCodePrefixes = new List<string> { "50" } },
            new() { NotCode = "52", Section = "Kaynaklar", AccountName = "Sermaye Yedekleri", DisplayOrder = 2, AccountCodePrefixes = new List<string> { "52" } },
            new() { NotCode = "54", Section = "Kaynaklar", AccountName = "Kar Yedekleri", DisplayOrder = 3, AccountCodePrefixes = new List<string> { "54" } },
            new() { NotCode = "57", Section = "Kaynaklar", AccountName = "Geçmiş Yıl Karları (+)", DisplayOrder = 4, AccountCodePrefixes = new List<string> { "57" } },
            new() { NotCode = "58", Section = "Kaynaklar", AccountName = "Geçmiş Yıl Zararları (-)", DisplayOrder = 5, AccountCodePrefixes = new List<string> { "58" } },
            new() { NotCode = "59", Section = "Kaynaklar", AccountName = "Dönem Net Karı/(Zararı)", DisplayOrder = 6, AccountCodePrefixes = new List<string> { "59" } },
            
            // KAYNAKLAR - UZUN VADELİ KAYNAKLAR
            new() { NotCode = "40", Section = "Kaynaklar", AccountName = "Borçlanmalar UV", DisplayOrder = 7, AccountCodePrefixes = new List<string> { "40" } },
            new() { NotCode = "41", Section = "Kaynaklar", AccountName = "Ticari Borçlar UV", DisplayOrder = 8, AccountCodePrefixes = new List<string> { "41" } },
            new() { NotCode = "42", Section = "Kaynaklar", AccountName = "Kiralama Yükümlülükleri UV", DisplayOrder = 9, AccountCodePrefixes = new List<string> { "42" } },
            new() { NotCode = "43", Section = "Kaynaklar", AccountName = "Diğer Borçlar UV", DisplayOrder = 10, AccountCodePrefixes = new List<string> { "43" } },
            new() { NotCode = "44", Section = "Kaynaklar", AccountName = "Alınan Avanslar UV", DisplayOrder = 11, AccountCodePrefixes = new List<string> { "44" } },
            new() { NotCode = "47", Section = "Kaynaklar", AccountName = "Karşılıklar UV", DisplayOrder = 12, AccountCodePrefixes = new List<string> { "47" } },
            new() { NotCode = "48", Section = "Kaynaklar", AccountName = "Diğer Karşılıklar UV", DisplayOrder = 13, AccountCodePrefixes = new List<string> { "48" } },
            new() { NotCode = "49", Section = "Kaynaklar", AccountName = "Diğer Yükümlülükler UV", DisplayOrder = 14, AccountCodePrefixes = new List<string> { "49" } },
            
            // KAYNAKLAR - CURRENT LIABILITIES
            new() { NotCode = "30", Section = "Kaynaklar", AccountName = "Borçlanmalar KV", DisplayOrder = 15, AccountCodePrefixes = new List<string> { "30" } },
            new() { NotCode = "32", Section = "Kaynaklar", AccountName = "Ticari Borçlar KV", DisplayOrder = 16, AccountCodePrefixes = new List<string> { "32" } },
            new() { NotCode = "33", Section = "Kaynaklar", AccountName = "Diğer Borçlar KV", DisplayOrder = 17, AccountCodePrefixes = new List<string> { "33" } },
            new() { NotCode = "34", Section = "Kaynaklar", AccountName = "Alınan Avanslar KV", DisplayOrder = 18, AccountCodePrefixes = new List<string> { "34" } },
            new() { NotCode = "35", Section = "Kaynaklar", AccountName = "Yıllara Yaygın İnşaat Onarım Hakedişleri KV", DisplayOrder = 19, AccountCodePrefixes = new List<string> { "35" } },
            new() { NotCode = "36", Section = "Kaynaklar", AccountName = "Ödenecek Vergi Ve Fonlar KV", DisplayOrder = 20, AccountCodePrefixes = new List<string> { "36" } },
            new() { NotCode = "37", Section = "Kaynaklar", AccountName = "Karşılıklar KV", DisplayOrder = 21, AccountCodePrefixes = new List<string> { "37" } },
            new() { NotCode = "38", Section = "Kaynaklar", AccountName = "Ertelenmiş Gelirler KV", DisplayOrder = 22, AccountCodePrefixes = new List<string> { "38" } },
            new() { NotCode = "39", Section = "Kaynaklar", AccountName = "Diğer Yükümlülükler KV", DisplayOrder = 23, AccountCodePrefixes = new List<string> { "39" } }
        };
    }
}
