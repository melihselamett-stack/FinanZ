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

        // VARLIKLAR bölümü
        var varliklarList = new List<object>();
        
        // DURAN VARLIKLAR başlığı
        varliklarList.Add(new { Name = "DURAN VARLIKLAR", IsCategory = true, NotCode = (string?)null, Values = new Dictionary<string, decimal>() });
        
        // DURAN VARLIKLAR alt kalemleri (L1 kodlarına göre grupla)
        var duranVarliklar = await GetBilancoSectionByL1(companyId, year.Value, allPeriods, new[] { "2" });
        foreach (var item in duranVarliklar)
        {
            varliklarList.Add(item);
        }
        if (duranVarliklar.Count > 0)
        {
            var duranToplam = CalculateSectionTotal(duranVarliklar.Cast<object>().ToList(), allPeriods);
            varliklarList.Add(new { Name = "DURAN VARLIKLAR", IsCategory = true, NotCode = (string?)null, Values = duranToplam });
        }

        // DÖNEN VARLIKLAR başlığı
        varliklarList.Add(new { Name = "DÖNEN VARLIKLAR", IsCategory = true, NotCode = (string?)null, Values = new Dictionary<string, decimal>() });
        
        // DÖNEN VARLIKLAR alt kalemleri (L1 kodlarına göre grupla)
        var donenVarliklar = await GetBilancoSectionByL1(companyId, year.Value, allPeriods, new[] { "1" });
        foreach (var item in donenVarliklar)
        {
            varliklarList.Add(item);
        }
        if (donenVarliklar.Count > 0)
        {
            var donenToplam = CalculateSectionTotal(donenVarliklar.Cast<object>().ToList(), allPeriods);
            varliklarList.Add(new { Name = "DÖNEN VARLIKLAR", IsCategory = true, NotCode = (string?)null, Values = donenToplam });
        }

        // TOPLAM VARLIKLAR
        if (varliklarList.Count > 0)
        {
            var toplamVarliklar = CalculateSectionTotal(
                varliklarList.Where(i => !IsCategoryOrTotalRow(i)).ToList(), 
                allPeriods
            );
            varliklarList.Add(new { Name = "TOPLAM VARLIKLAR", IsTotal = true, NotCode = (string?)null, Values = toplamVarliklar });
        }

        // KAYNAKLAR bölümü
        var kaynaklarList = new List<object>();

        // ÖZKAYNAKLAR başlığı
        kaynaklarList.Add(new { Name = "ÖZKAYNAKLAR", IsCategory = true, NotCode = (string?)null, Values = new Dictionary<string, decimal>() });
        
        // ÖZKAYNAKLAR alt kalemleri (L1 kodlarına göre grupla)
        var ozkaynaklar = await GetBilancoSectionByL1(companyId, year.Value, allPeriods, new[] { "5" });
        foreach (var item in ozkaynaklar)
        {
            kaynaklarList.Add(item);
        }
        if (ozkaynaklar.Count > 0)
        {
            var ozkaynakToplam = CalculateSectionTotal(ozkaynaklar.Cast<object>().ToList(), allPeriods);
            kaynaklarList.Add(new { Name = "ÖZKAYNAKLAR", IsCategory = true, NotCode = (string?)null, Values = ozkaynakToplam });
        }

        // UZUN VADELİ KAYNAKLAR başlığı
        kaynaklarList.Add(new { Name = "UZUN VADELİ KAYNAKLAR", IsCategory = true, NotCode = (string?)null, Values = new Dictionary<string, decimal>() });
        
        // UZUN VADELİ KAYNAKLAR alt kalemleri (L1 kodlarına göre grupla)
        var uzunVadeli = await GetBilancoSectionByL1(companyId, year.Value, allPeriods, new[] { "4" });
        foreach (var item in uzunVadeli)
        {
            kaynaklarList.Add(item);
        }
        if (uzunVadeli.Count > 0)
        {
            var uzunVadeliToplam = CalculateSectionTotal(uzunVadeli.Cast<object>().ToList(), allPeriods);
            kaynaklarList.Add(new { Name = "UZUN VADELİ KAYNAKLAR", IsCategory = true, NotCode = (string?)null, Values = uzunVadeliToplam });
        }

        // CURRENT LIABILITIES başlığı
        kaynaklarList.Add(new { Name = "CURRENT LIABILITIES", IsCategory = true, NotCode = (string?)null, Values = new Dictionary<string, decimal>() });
        
        // CURRENT LIABILITIES alt kalemleri (L1 kodlarına göre grupla)
        var kisaVadeli = await GetBilancoSectionByL1(companyId, year.Value, allPeriods, new[] { "3" });
        foreach (var item in kisaVadeli)
        {
            kaynaklarList.Add(item);
        }
        if (kisaVadeli.Count > 0)
        {
            var kisaVadeliToplam = CalculateSectionTotal(kisaVadeli.Cast<object>().ToList(), allPeriods);
            kaynaklarList.Add(new { Name = "CURRENT LIABILITIES", IsCategory = true, NotCode = (string?)null, Values = kisaVadeliToplam });
        }

        // TOPLAM YÜKÜMLÜLÜKLER
        if (kaynaklarList.Count > 0)
        {
            var toplamYukumlulukler = CalculateSectionTotal(
                kaynaklarList.Where(i => !IsCategoryOrTotalRow(i)).ToList(), 
                allPeriods
            );
            kaynaklarList.Add(new { Name = "TOPLAM YÜKÜMLÜLÜKLER", IsTotal = true, NotCode = (string?)null, Values = toplamYukumlulukler });
        }

        // TOPLAM KAYNAKLAR
        if (kaynaklarList.Count > 0)
        {
            var toplamKaynaklar = CalculateSectionTotal(
                kaynaklarList.Where(i => !IsCategoryOrTotalRow(i)).ToList(), 
                allPeriods
            );
            kaynaklarList.Add(new { Name = "TOPLAM KAYNAKLAR", IsTotal = true, NotCode = (string?)null, Values = toplamKaynaklar });
        }

        return Ok(new
        {
            Year = year.Value,
            Periods = allPeriodsRaw.Select(p => new { p.Year, p.Month }).ToList(),
            Varliklar = varliklarList,
            Kaynaklar = kaynaklarList
        });
    }

    [HttpGet("company/{companyId}/not/{notCode}/details")]
    public async Task<ActionResult<object>> GetNotCodeDetails(int companyId, string notCode, [FromQuery] int? year)
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
                    NotCode = notCode,
                    Year = 0,
                    Periods = new List<object>(),
                    Accounts = new List<object>()
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

        // NOT koduna göre alt hesapları getir (sadece leaf hesaplar)
        var accountsWithBalances = await _context.MonthlyBalances
            .Include(m => m.AccountPlan)
            .Where(m => m.CompanyId == companyId && 
                       m.Year == year.Value &&
                       m.AccountPlan != null &&
                       m.AccountPlan.IsLeaf == true)
            .ToListAsync();

        // NOT koduna göre filtrele (hesap kodunun ilk iki hanesi)
        var filteredAccounts = accountsWithBalances
            .Where(m =>
            {
                var codeParts = m.AccountPlan!.AccountCode.Split('.');
                var firstPart = codeParts.Length > 0 ? codeParts[0] : m.AccountPlan.AccountCode;
                var l1Code = firstPart.Length >= 2 ? firstPart.Substring(0, 2) : firstPart;
                return l1Code == notCode;
            })
            .GroupBy(m => new { m.AccountPlanId, m.AccountPlan!.AccountCode, m.AccountPlan.AccountName })
            .Select(g => new
            {
                AccountCode = g.Key.AccountCode,
                AccountName = g.Key.AccountName,
                Balances = g.Select(b => new
                {
                    b.Month,
                    b.DebitBalance,
                    b.CreditBalance,
                    NetBalance = b.DebitBalance - b.CreditBalance
                }).ToList()
            })
            .OrderBy(a => a.AccountCode)
            .ToList();

        var result = filteredAccounts.Select(a => new
        {
            a.AccountCode,
            a.AccountName,
            Values = allPeriodsRaw.ToDictionary(
                p => $"{p.Month}",
                p =>
                {
                    var balance = a.Balances.FirstOrDefault(b => b.Month == p.Month);
                    return balance != null ? balance.NetBalance : 0m;
                }
            ),
            Total = a.Balances.Sum(b => b.NetBalance)
        }).ToList();

        return Ok(new
        {
            NotCode = notCode,
            Year = year.Value,
            Periods = allPeriodsRaw.Select(p => new { p.Year, p.Month }).ToList(),
            Accounts = result
        });
    }

    private async Task<List<Dictionary<string, object>>> GetBilancoSectionByL1(
        int companyId, 
        int year, 
        List<(int Year, int Month)> periods, 
        string[] codePrefixes)
    {
        var items = new List<Dictionary<string, object>>();

        // Custom parametrelerde tanımlı NOT kodlarını al
        var company = await _context.Companies.FindAsync(companyId);
        var customNotCodes = new HashSet<string>();
        if (company != null && !string.IsNullOrEmpty(company.BilancoParametersJson))
        {
            try
            {
                var customParams = JsonSerializer.Deserialize<List<BilancoParameterDto>>(company.BilancoParametersJson);
                if (customParams != null)
                {
                    var section = codePrefixes[0] == "1" || codePrefixes[0] == "2" ? "Varliklar" : "Kaynaklar";
                    var relevantParams = customParams.Where(p => p.Section == section);
                    foreach (var param in relevantParams)
                    {
                        customNotCodes.Add(param.NotCode);
                    }
                }
            }
            catch
            {
                // JSON parse hatası durumunda devam et
            }
        }

        // Yüklenen mizan verilerinden sadece leaf (yaprak) hesapları getir
        var accountsWithBalances = await _context.MonthlyBalances
            .Include(m => m.AccountPlan)
            .Where(m => m.CompanyId == companyId && 
                       m.Year == year &&
                       m.AccountPlan != null &&
                       m.AccountPlan.IsLeaf == true && // Sadece leaf hesaplar
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

        // L1 kodlarına göre grupla (hesap kodunun ilk iki hanesi)
        var l1Groups = accountsWithBalances
            .GroupBy(a => 
            {
                // Önce nokta ile ayrılmış formatı kontrol et (örn: "22.0.0")
                var codeParts = a.AccountCode.Split('.');
                if (codeParts.Length > 0 && codeParts[0].Length >= 2)
                {
                    return codeParts[0].Substring(0, 2);
                }
                // Nokta yoksa, direkt hesap kodunun ilk iki hanesini al (örn: "220" -> "22")
                if (a.AccountCode.Length >= 2)
                {
                    return a.AccountCode.Substring(0, 2);
                }
                return a.AccountCode;
            })
            .ToList();

        // Custom parametrelerde tanımlı ama veritabanında olmayan NOT kodları için işle
        // Bu NOT kodları için direkt olarak GetRowNamesByL1Code çağrılacak

        // Önce veritabanındaki hesaplardan gelen L1 gruplarını işle
        foreach (var l1Group in l1Groups.OrderBy(g => g.Key))
        {
            var l1Code = l1Group.Key;
            var allAccountCodes = l1Group.Select(a => a.AccountCode).ToList();
            var rowNames = await GetRowNamesByL1Code(companyId, l1Code, codePrefixes[0], allAccountCodes);
            
            foreach (var rowInfo in rowNames)
            {
                var rowName = rowInfo.Name;
                var notCode = rowInfo.NotCode;
                var accountCodes = rowInfo.AccountCodes;

                var values = new Dictionary<string, decimal>();
                decimal total = 0;

                // Her dönem için bakiye hesapla
                foreach (var (periodYear, periodMonth) in periods)
                {
                    decimal periodTotal = 0;
                    foreach (var accountData in l1Group.Where(a => accountCodes.Contains(a.AccountCode)))
                    {
                        // Aynı hesap için aynı ay için tüm bakiyeleri topla (eğer birden fazla kayıt varsa)
                        var balance = accountData.Balances
                            .Where(b => b.Month == periodMonth)
                            .Sum(b => b.DebitBalance - b.CreditBalance);
                        periodTotal += balance;
                    }

                    var periodKey = $"{periodMonth}";
                    values[periodKey] = periodTotal;
                    total += periodTotal;
                }

                values["Total"] = total;

                items.Add(new Dictionary<string, object>
                {
                    { "Name", rowName },
                    { "NotCode", notCode },
                    { "Values", values }
                });
            }
        }

        // Custom parametrelerde tanımlı ama veritabanında olmayan NOT kodları için işle
        foreach (var customNotCode in customNotCodes)
        {
            if (!l1Groups.Any(g => g.Key == customNotCode))
            {
                // Bu NOT kodu için boş hesap listesi ile row names al
                var rowNames = await GetRowNamesByL1Code(companyId, customNotCode, codePrefixes[0], new List<string>());
                
                foreach (var rowInfo in rowNames)
                {
                    var rowName = rowInfo.Name;
                    var notCode = rowInfo.NotCode;
                    var accountCodes = rowInfo.AccountCodes;

                    // Eğer accountCodes boşsa, NOT kodunun ilk 2 hanesine göre hesapları bul
                    // AMA codePrefixes ile de filtrele (DÖNEN için 1, DURAN için 2, vb.)
                    if (!accountCodes.Any())
                    {
                        // NOT kodunun ilk 2 hanesine göre hesapları bul, ama codePrefixes ile de filtrele
                        var matchingAccounts = accountsWithBalances.Where(a =>
                        {
                            // Önce codePrefixes kontrolü (DÖNEN VARLIKLAR için 1, DURAN VARLIKLAR için 2, vb.)
                            var codeStartsWithPrefix = codePrefixes.Any(prefix => a.AccountCode.StartsWith(prefix));
                            if (!codeStartsWithPrefix)
                                return false;

                            // Sonra NOT koduna göre kontrol
                            var codeParts = a.AccountCode.Split('.');
                            var firstPart = codeParts.Length > 0 ? codeParts[0] : a.AccountCode;
                            if (customNotCode.Length >= 2 && firstPart.Length >= 2)
                            {
                                return firstPart.Substring(0, 2) == customNotCode;
                            }
                            return firstPart.StartsWith(customNotCode);
                        }).ToList();

                        accountCodes = matchingAccounts.Select(a => a.AccountCode).ToList();
                    }
                    else
                    {
                        // AccountCodes varsa, codePrefixes ile de filtrele
                        // Ayrıca accountsWithBalances içinde olan hesapları kontrol et
                        accountCodes = accountCodes.Where(code =>
                        {
                            // Önce codePrefixes kontrolü
                            if (!codePrefixes.Any(prefix => code.StartsWith(prefix)))
                                return false;
                            
                            // Sonra accountsWithBalances içinde olup olmadığını kontrol et
                            return accountsWithBalances.Any(a => a.AccountCode == code);
                        }).ToList();
                    }

                    // Eğer accountCodes hala boşsa, bu NOT kodu için veri yok demektir, atla
                    if (!accountCodes.Any())
                        continue;

                    var values = new Dictionary<string, decimal>();
                    decimal total = 0;

                    // Her dönem için bakiye hesapla
                    // accountsWithBalances zaten codePrefixes ile filtrelenmiş, bu yüzden sadece accountCodes ile eşleşenleri al
                    foreach (var (periodYear, periodMonth) in periods)
                    {
                        decimal periodTotal = 0;
                        foreach (var accountData in accountsWithBalances.Where(a => accountCodes.Contains(a.AccountCode)))
                        {
                            var balance = accountData.Balances
                                .Where(b => b.Month == periodMonth)
                                .Sum(b => b.DebitBalance - b.CreditBalance);
                            periodTotal += balance;
                        }

                        var periodKey = $"{periodMonth}";
                        values[periodKey] = periodTotal;
                        total += periodTotal;
                    }

                    values["Total"] = total;

                    items.Add(new Dictionary<string, object>
                    {
                        { "Name", rowName },
                        { "NotCode", notCode },
                        { "Values", values }
                    });
                }
            }
        }

        return items;
    }

    private class RowInfo
    {
        public string Name { get; set; } = string.Empty;
        public string NotCode { get; set; } = string.Empty;
        public List<string> AccountCodes { get; set; } = new List<string>();
    }

    private async Task<List<RowInfo>> GetRowNamesByL1Code(int companyId, string l1Code, string mainPrefix, List<string> allAccountCodes)
    {
        var result = new List<RowInfo>();
        
        // Önce custom parametreleri kontrol et
        var company = await _context.Companies.FindAsync(companyId);
        if (company != null && !string.IsNullOrEmpty(company.BilancoParametersJson))
        {
            try
            {
                var customParams = JsonSerializer.Deserialize<List<BilancoParameterDto>>(company.BilancoParametersJson);
                if (customParams != null)
                {
                    var section = mainPrefix == "1" || mainPrefix == "2" ? "Varliklar" : "Kaynaklar";
                    var customParam = customParams.FirstOrDefault(p => p.NotCode == l1Code && p.Section == section);
                    
                    if (customParam != null)
                    {
                        // Custom parametreye göre hesap kodlarını filtrele
                        List<string> filteredCodes;
                        
                        if (customParam.AccountCodePrefixes != null && customParam.AccountCodePrefixes.Any())
                        {
                            // Eğer prefix'ler tanımlıysa, onlara göre filtrele
                            filteredCodes = allAccountCodes.Where(code =>
                            {
                                var codeParts = code.Split('.');
                                var firstPart = codeParts.Length > 0 ? codeParts[0] : code;
                                
                                return customParam.AccountCodePrefixes.Any(prefix =>
                                {
                                    // Prefix ile eşleşen kodları bul
                                    if (firstPart.StartsWith(prefix))
                                    {
                                        // Eğer prefix 2 haneli ise (örn: "10"), ilk 2 haneyi kontrol et
                                        if (prefix.Length == 2 && firstPart.Length >= 2)
                                        {
                                            return firstPart.Substring(0, 2) == prefix;
                                        }
                                        // Eğer prefix 3 haneli ise (örn: "100"), ilk 3 haneyi kontrol et
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
                            // Eğer prefix tanımlı değilse, NOT kodunun ilk 2 hanesine göre otomatik filtrele
                            // Örneğin NOT 14 için, 14 ile başlayan tüm hesapları al
                            filteredCodes = allAccountCodes.Where(code =>
                            {
                                var codeParts = code.Split('.');
                                var firstPart = codeParts.Length > 0 ? codeParts[0] : code;
                                
                                // NOT kodunun ilk 2 hanesine göre kontrol et
                                if (l1Code.Length >= 2 && firstPart.Length >= 2)
                                {
                                    return firstPart.Substring(0, 2) == l1Code;
                                }
                                return firstPart.StartsWith(l1Code);
                            }).ToList();
                            
                            // Eğer hala boşsa, tüm hesapları al (fallback)
                            if (!filteredCodes.Any())
                            {
                                filteredCodes = allAccountCodes;
                            }
                        }

                        result.Add(new RowInfo
                        {
                            Name = customParam.AccountName,
                            NotCode = l1Code,
                            AccountCodes = filteredCodes
                        });
                        return result;
                    }
                }
            }
            catch
            {
                // JSON parse hatası durumunda varsayılan mapping'e devam et
            }
        }

        // Custom parametre yoksa varsayılan mantığı kullan
        
        // Custom parametre yoksa varsayılan mantığı kullan
        // NOT: 13 için tüm hesapları "Diğer Alacaklar" olarak birleştir
        if (l1Code == "13" && mainPrefix == "1")
        {
            result.Add(new RowInfo
            {
                Name = "Diğer Alacaklar",
                NotCode = "13",
                AccountCodes = allAccountCodes
            });
            return result;
        }

        // NOT: 50 için tüm hesapları "Ödenmiş Sermaye" olarak birleştir (Sermaye Düzeltmesi dahil)
        if (l1Code == "50" && mainPrefix == "5")
        {
            result.Add(new RowInfo
            {
                Name = "Ödenmiş Sermaye",
                NotCode = "50",
                AccountCodes = allAccountCodes
            });
            return result;
        }

        // Standart durum: Tek satır
        var rowName = GetRowNameByL1Code(l1Code, mainPrefix);
        if (!string.IsNullOrEmpty(rowName))
        {
            result.Add(new RowInfo
            {
                Name = rowName,
                NotCode = l1Code,
                AccountCodes = allAccountCodes
            });
        }

        return result;
    }

    private string GetRowNameByL1Code(string l1Code, string mainPrefix)
    {
        // Görüntüdeki satır isimlerine göre mapping
        var mapping = new Dictionary<string, Dictionary<string, string>>
        {
            ["2"] = new Dictionary<string, string> // DURAN VARLIKLAR
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
            ["1"] = new Dictionary<string, string> // DÖNEN VARLIKLAR
            {
                ["10"] = "Nakit Ve Nakit Benzerleri",
                ["11"] = "Menkul Kıymetler",
                ["12"] = "Ticari Alacaklar",
                ["13"] = "Ortaklardan Alacaklar",
                ["131"] = "Diğer Alacaklar", // 131, 132, 133, 134, 135, 136, 137, 138, 139
                ["14"] = "Şüpheli Ticari Alacaklar Karşılığı (-)",
                ["15"] = "Stoklar",
                ["16"] = "Kısa Vadeli Finansal Kiralamalar",
                ["17"] = "Yapılmakta Olan Yatırımlar (İnşaat)",
                ["18"] = "Peşin Ödenmiş Giderler",
                ["19"] = "Diğer Dönen Varlıklar"
            },
            ["5"] = new Dictionary<string, string> // ÖZKAYNAKLAR
            {
                ["50"] = "Ödenmiş Sermaye",
                ["501"] = "Sermaye Düzeltmesi (+)", // 501, 502, 503, 504, 505, 506, 507, 508, 509
                ["502"] = "Sermaye Düzeltmesi (-)", // 502, 503, 504, 505, 506, 507, 508, 509
                ["52"] = "Sermaye Yedekleri",
                ["54"] = "Kar Yedekleri",
                ["57"] = "Geçmiş Yıl Karları (+)",
                ["58"] = "Geçmiş Yıl Zararları (-)",
                ["59"] = "Dönem Net Karı/(Zararı)"
            },
            ["4"] = new Dictionary<string, string> // UZUN VADELİ KAYNAKLAR
            {
                ["40"] = "Borçlanmalar UV",
                ["41"] = "Ticari Borçlar UV",
                ["42"] = "Kiralama Yükümlülükleri UV",
                ["43"] = "Ortaklara Borçlar UV",
                ["431"] = "Kiralama Yükümlülükleri UV", // 431, 432, 433, 434, 435, 436, 437, 438, 439
                ["44"] = "Alınan Avanslar UV",
                ["47"] = "Karşılıklar UV",
                ["48"] = "Diğer Karşılıklar UV",
                ["49"] = "Diğer Yükümlülükler UV"
            },
            ["3"] = new Dictionary<string, string> // CURRENT LIABILITIES
            {
                ["30"] = "Borçlanmalar KV",
                ["32"] = "Ticari Borçlar KV",
                ["33"] = "Ortaklara Borçlar KV",
                ["331"] = "Diğer Borçlar KV", // 331, 332, 333, 334, 335, 336, 337, 338, 339
                ["34"] = "Alınan Avanslar KV",
                ["35"] = "Yıllara Yaygın İnşaat Onarım Hakedişleri KV",
                ["36"] = "Ödenecek Vergi Ve Fonlar KV",
                ["37"] = "Karşılıklar KV",
                ["38"] = "Ertelenmiş Gelirler KV",
                ["39"] = "Diğer Yükümlülükler KV"
            }
        };

        if (mapping.ContainsKey(mainPrefix) && mapping[mainPrefix].ContainsKey(l1Code))
        {
            return mapping[mainPrefix][l1Code];
        }

        // Eğer mapping'de yoksa, hesap adını kullan
        return $"L1: {l1Code}";
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
