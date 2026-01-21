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
public class GelirTablosuController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public GelirTablosuController(ApplicationDbContext context)
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
    public async Task<ActionResult<object>> GetGelirTablosu(int companyId, [FromQuery] int? year)
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
                    Items = new List<object>()
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
                Items = new List<object>()
            });
        }

        // Tuple list'e çevir
        var allPeriods = allPeriodsRaw.Select(p => (p.Year, p.Month)).ToList();

        var items = new List<object>();

        // A- BRÜT SATIŞLAR
        // 1. YURTİÇİ SATIŞLAR (600)
        var yurticiSatislar = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "600");
        items.Add(new { Name = "1- YURTİÇİ SATIŞLAR", NotCode = "600", Values = yurticiSatislar });

        // 2. YURTDIŞI SATIŞLAR (601)
        var yurtdisiSatislar = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "601");
        items.Add(new { Name = "2- YURTDIŞI SATIŞLAR", NotCode = "601", Values = yurtdisiSatislar });

        // 3. DİĞER GELİRLER (602)
        var digerGelirler = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "602");
        items.Add(new { Name = "3- DİĞER GELİRLER", NotCode = "602", Values = digerGelirler });

        // BRÜT SATIŞLAR TOPLAMI
        var brutSatislarToplam = CalculateTotal(new[] { yurticiSatislar, yurtdisiSatislar, digerGelirler }, allPeriods);
        items.Add(new { Name = "A- BRÜT SATIŞLAR", IsCategory = true, NotCode = (string?)null, Values = brutSatislarToplam });

        // B- SATIŞ İNDİRİMLERİ (-)
        // 1. SATIŞTAN İADELER (-) (610)
        var satistanIadeler = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "610", isNegative: true);
        items.Add(new { Name = "1- SATIŞTAN İADELER (-)", NotCode = "610", Values = satistanIadeler });

        // 2. SATIŞ İSKONTOLARI (-) (611)
        var satisIskontolari = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "611", isNegative: true);
        items.Add(new { Name = "2- SATIŞ İSKONTOLARI (-)", NotCode = "611", Values = satisIskontolari });

        // 3. DİĞER İNDİRİMLER (-) (612)
        var digerIndirimler = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "612", isNegative: true);
        items.Add(new { Name = "3- DİĞER İNDİRİMLER (-)", NotCode = "612", Values = digerIndirimler });

        // SATIŞ İNDİRİMLERİ TOPLAMI
        var satisIndirimleriToplam = CalculateTotal(new[] { satistanIadeler, satisIskontolari, digerIndirimler }, allPeriods);
        items.Add(new { Name = "B- SATIŞ İNDİRİMLERİ (-)", IsCategory = true, NotCode = (string?)null, Values = satisIndirimleriToplam });

        // C- NET SATIŞLAR (hesaplanan: A - B)
        var netSatislar = CalculateDifference(brutSatislarToplam, satisIndirimleriToplam, allPeriods);
        items.Add(new { Name = "C- NET SATIŞLAR", IsTotal = true, NotCode = (string?)null, Values = netSatislar });

        // D- SATIŞLARIN MALİYETİ (-)
        // 1. SATILAN MAMÜLLER MALİYETİ (-) (620)
        var satilanMamullerMaliyeti = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "620", isNegative: true);
        items.Add(new { Name = "1- SATILAN MAMÜLLER MALİYETİ (-)", NotCode = "620", Values = satilanMamullerMaliyeti });

        // 2. SATILAN TİCARİ MALLAR MALİYETİ (-) (621)
        var satilanTicariMallarMaliyeti = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "621", isNegative: true);
        items.Add(new { Name = "2- SATILAN TİCARİ MALLAR MALİYETİ (-)", NotCode = "621", Values = satilanTicariMallarMaliyeti });

        // 3. SATILAN HİZMET MALİYETİ (-) (622)
        var satilanHizmetMaliyeti = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "622", isNegative: true);
        items.Add(new { Name = "3- SATILAN HİZMET MALİYETİ (-)", NotCode = "622", Values = satilanHizmetMaliyeti });

        // 4. DİĞER SATIŞLARIN MALİYETİ (-) (623)
        var digerSatislarMaliyeti = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "623", isNegative: true);
        items.Add(new { Name = "4- DİĞER SATIŞLARIN MALİYETİ (-)", NotCode = "623", Values = digerSatislarMaliyeti });

        // SATIŞLARIN MALİYETİ TOPLAMI
        var satislarMaliyetiToplam = CalculateTotal(new[] { satilanMamullerMaliyeti, satilanTicariMallarMaliyeti, satilanHizmetMaliyeti, digerSatislarMaliyeti }, allPeriods);
        items.Add(new { Name = "D- SATIŞLARIN MALİYETİ (-)", IsCategory = true, NotCode = (string?)null, Values = satislarMaliyetiToplam });

        // BRÜT SATIŞ KARI VEYA ZARARI (hesaplanan: C - D)
        var brutSatisKarZarar = CalculateDifference(netSatislar, satislarMaliyetiToplam, allPeriods);
        items.Add(new { Name = "BRÜT SATIŞ KARI VEYA ZARARI", IsTotal = true, NotCode = (string?)null, Values = brutSatisKarZarar });

        // E- FAALİYET GİDERLERİ (-)
        // 1. ARAŞTIRMA VE GELİŞTİRME GİDERLERİ (-) (630)
        var arastirmaGelistirme = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "630", isNegative: true);
        items.Add(new { Name = "1- ARAŞTIRMA VE GELİŞTİRME GİDERLERİ (-)", NotCode = "630", Values = arastirmaGelistirme });

        // 2. PAZARLAMA SATIŞ VE DAĞITIM GİDERLERİ (-) (631)
        var pazarlamaSatisDagitim = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "631", isNegative: true);
        items.Add(new { Name = "2- PAZARLAMA SATIŞ VE DAĞITIM GİDERLERİ (-)", NotCode = "631", Values = pazarlamaSatisDagitim });

        // 3. GENEL YÖNETİM GİDERLERİ (-) (632)
        var genelYonetim = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "632", isNegative: true);
        items.Add(new { Name = "3- GENEL YÖNETİM GİDERLERİ (-)", NotCode = "632", Values = genelYonetim });

        // FAALİYET GİDERLERİ TOPLAMI
        var faaliyetGiderleriToplam = CalculateTotal(new[] { arastirmaGelistirme, pazarlamaSatisDagitim, genelYonetim }, allPeriods);
        items.Add(new { Name = "E- FAALİYET GİDERLERİ (-)", IsCategory = true, NotCode = (string?)null, Values = faaliyetGiderleriToplam });

        // FAALİYET KARI VEYA ZARARI (hesaplanan: BRÜT SATIŞ KARI - E)
        var faaliyetKarZarar = CalculateDifference(brutSatisKarZarar, faaliyetGiderleriToplam, allPeriods);
        items.Add(new { Name = "FAALİYET KARI VEYA ZARARI", IsTotal = true, NotCode = (string?)null, Values = faaliyetKarZarar });

        // F- DİĞER FAALİYETLERDEN OLAĞAN GELİR VE KARLAR
        // 1. İŞTİRAKLERDEN TEMETTÜ GELİRLERİ (640)
        var istiraklerdenTemetu = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "640");
        items.Add(new { Name = "1- İŞTİRAKLERDEN TEMETTÜ GELİRLERİ", NotCode = "640", Values = istiraklerdenTemetu });

        // 2. BAĞLI ORTAKLIKLARDAN TEMETTÜ GELİRLERİ (641)
        var bagliOrtakliklardanTemetu = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "641");
        items.Add(new { Name = "2- BAĞLI ORTAKLIKLARDAN TEMETTÜ GELİRLERİ", NotCode = "641", Values = bagliOrtakliklardanTemetu });

        // 3. FAİZ GELİRLERİ (642)
        var faizGelirleri = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "642");
        items.Add(new { Name = "3- FAİZ GELİRLERİ", NotCode = "642", Values = faizGelirleri });

        // 4. KOMİSYON GELİRLERİ (643)
        var komisyonGelirleri = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "643");
        items.Add(new { Name = "4- KOMİSYON GELİRLERİ", NotCode = "643", Values = komisyonGelirleri });

        // 5. KONUSU KALMAYAN KARŞILIKLAR (644)
        var konusuKalmayanKarsiliklar = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "644");
        items.Add(new { Name = "5- KONUSU KALMAYAN KARŞILIKLAR", NotCode = "644", Values = konusuKalmayanKarsiliklar });

        // 6. MENKUL KIYMET SATIŞ KARLARI (645)
        var menkulKiyasetSatisKarlari = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "645");
        items.Add(new { Name = "6- MENKUL KIYMET SATIŞ KARLARI", NotCode = "645", Values = menkulKiyasetSatisKarlari });

        // 7. KAMBİYO KARLARI (646)
        var kambiyoKarlari = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "646");
        items.Add(new { Name = "7- KAMBİYO KARLARI", NotCode = "646", Values = kambiyoKarlari });

        // 8. REESKONT FAİZ GELİRLERİ (647)
        var reeskontFaizGelirleri = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "647");
        items.Add(new { Name = "8- REESKONT FAİZ GELİRLERİ", NotCode = "647", Values = reeskontFaizGelirleri });

        // 9. ENFLASYON DÜZELTMESİ KARLARI (648)
        var enflasyonDuzeltmesiKarlari = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "648");
        items.Add(new { Name = "9- ENFLASYON DÜZELTMESİ KARLARI", NotCode = "648", Values = enflasyonDuzeltmesiKarlari });

        // 10. DİĞER OLAĞAN GELİR VE KARLAR (649)
        var digerOlaganGelirKarlar = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "649");
        items.Add(new { Name = "10- DİĞER OLAĞAN GELİR VE KARLAR", NotCode = "649", Values = digerOlaganGelirKarlar });

        // F TOPLAMI
        var digerFaaliyetGelirToplam = CalculateTotal(new[] { istiraklerdenTemetu, bagliOrtakliklardanTemetu, faizGelirleri, komisyonGelirleri, konusuKalmayanKarsiliklar, menkulKiyasetSatisKarlari, kambiyoKarlari, reeskontFaizGelirleri, enflasyonDuzeltmesiKarlari, digerOlaganGelirKarlar }, allPeriods);
        items.Add(new { Name = "F- DİĞER FAALİYETLERDEN OLAĞAN GELİR VE KARLAR", IsCategory = true, NotCode = (string?)null, Values = digerFaaliyetGelirToplam });

        // G- DİĞER FAALİYETLERDEN OLAĞAN GİDER VE ZARARLAR (-)
        // 1. KOMİSYON GİDERLERİ (-) (653)
        var komisyonGiderleri = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "653", isNegative: true);
        items.Add(new { Name = "1- KOMİSYON GİDERLERİ (-)", NotCode = "653", Values = komisyonGiderleri });

        // 2. KARŞILIK GİDERLERİ (-) (654)
        var karsilikGiderleri = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "654", isNegative: true);
        items.Add(new { Name = "2- KARŞILIK GİDERLERİ (-)", NotCode = "654", Values = karsilikGiderleri });

        // 3. MENKUL KIYMET SATIŞ ZARARLARI (-) (655)
        var menkulKiyasetSatisZararlari = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "655", isNegative: true);
        items.Add(new { Name = "3- MENKUL KIYMET SATIŞ ZARARLARI (-)", NotCode = "655", Values = menkulKiyasetSatisZararlari });

        // 4. KAMBİYO ZARARLARI (-) (656)
        var kambiyoZararlari = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "656", isNegative: true);
        items.Add(new { Name = "4- KAMBİYO ZARARLARI (-)", NotCode = "656", Values = kambiyoZararlari });

        // 5. REESKONT FAİZ GİDERLERİ (-) (657)
        var reeskontFaizGiderleri = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "657", isNegative: true);
        items.Add(new { Name = "5- REESKONT FAİZ GİDERLERİ (-)", NotCode = "657", Values = reeskontFaizGiderleri });

        // 6. ENFLASYON DÜZELTMESİ ZARARLARI (-) (658)
        var enflasyonDuzeltmesiZararlari = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "658", isNegative: true);
        items.Add(new { Name = "6- ENFLASYON DÜZELTMESİ ZARARLARI (-)", NotCode = "658", Values = enflasyonDuzeltmesiZararlari });

        // 7. DİĞER GİDER VE ZARARLAR (-) (659)
        var digerGiderZararlar = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "659", isNegative: true);
        items.Add(new { Name = "7- DİĞER GİDER VE ZARARLAR (-)", NotCode = "659", Values = digerGiderZararlar });

        // G TOPLAMI
        var digerFaaliyetGiderToplam = CalculateTotal(new[] { komisyonGiderleri, karsilikGiderleri, menkulKiyasetSatisZararlari, kambiyoZararlari, reeskontFaizGiderleri, enflasyonDuzeltmesiZararlari, digerGiderZararlar }, allPeriods);
        items.Add(new { Name = "G- DİĞER FAALİYETLERDEN OLAĞAN GİDER VE ZARARLAR (-)", IsCategory = true, NotCode = (string?)null, Values = digerFaaliyetGiderToplam });

        // H- FİNANSMAN GİDERLERİ (-)
        // 1. KISA VADELİ BORÇLANMA GİDERLERİ (-) (660)
        var kisaVadeliBorclanma = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "660", isNegative: true);
        items.Add(new { Name = "1- KISA VADELİ BORÇLANMA GİDERLERİ (-)", NotCode = "660", Values = kisaVadeliBorclanma });

        // 2. UZUN VADELİ BORÇLANMA GİDERLERİ (-) (661)
        var uzunVadeliBorclanma = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "661", isNegative: true);
        items.Add(new { Name = "2- UZUN VADELİ BORÇLANMA GİDERLERİ (-)", NotCode = "661", Values = uzunVadeliBorclanma });

        // H TOPLAMI
        var finansmanGiderleriToplam = CalculateTotal(new[] { kisaVadeliBorclanma, uzunVadeliBorclanma }, allPeriods);
        items.Add(new { Name = "H- FİNANSMAN GİDERLERİ (-)", IsCategory = true, NotCode = (string?)null, Values = finansmanGiderleriToplam });

        // OLAĞAN KAR VEYA ZARAR (hesaplanan: FAALİYET KARI + F - G - H)
        var olaganKarZarar = CalculateOlaganKarZarar(faaliyetKarZarar, digerFaaliyetGelirToplam, digerFaaliyetGiderToplam, finansmanGiderleriToplam, allPeriods);
        items.Add(new { Name = "OLAĞAN KAR VEYA ZARAR", IsTotal = true, NotCode = (string?)null, Values = olaganKarZarar });

        // I- OLAĞANDIŞI GELİR VE KARLAR
        // 1. ÖNCEKİ DÖNEM GELİR VE KARLARI (671)
        var oncekiDonemGelirKarlari = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "671");
        items.Add(new { Name = "1- ÖNCEKİ DÖNEM GELİR VE KARLARI", NotCode = "671", Values = oncekiDonemGelirKarlari });

        // 2. DİĞER OLAĞANDIŞI GELİR VE KARLAR (679)
        var digerOlaganDisiGelirKarlar = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "679");
        items.Add(new { Name = "2- DİĞER OLAĞANDIŞI GELİR VE KARLAR", NotCode = "679", Values = digerOlaganDisiGelirKarlar });

        // I TOPLAMI
        var olaganDisiGelirToplam = CalculateTotal(new[] { oncekiDonemGelirKarlari, digerOlaganDisiGelirKarlar }, allPeriods);
        items.Add(new { Name = "I- OLAĞANDIŞI GELİR VE KARLAR", IsCategory = true, NotCode = (string?)null, Values = olaganDisiGelirToplam });

        // J- OLAĞANDIŞI GİDER VE ZARARLAR (-)
        // 1. ÇALIŞMAYAN KISIM GİDER VE ZARARLARI (-) (680)
        var calismayanKisimGiderZararlari = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "680", isNegative: true);
        items.Add(new { Name = "1- ÇALIŞMAYAN KISIM GİDER VE ZARARLARI (-)", NotCode = "680", Values = calismayanKisimGiderZararlari });

        // 2. ÖNCEKİ DÖNEM GİDER VE ZARARLARI (-) (681)
        var oncekiDonemGiderZararlari = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "681", isNegative: true);
        items.Add(new { Name = "2- ÖNCEKİ DÖNEM GİDER VE ZARARLARI (-)", NotCode = "681", Values = oncekiDonemGiderZararlari });

        // 3. DİĞER OLAĞANDIŞI GİDER VE ZARARLAR (-) (689)
        var digerOlaganDisiGiderZararlar = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "689", isNegative: true);
        items.Add(new { Name = "3- DİĞER OLAĞANDIŞI GİDER VE ZARARLAR (-)", NotCode = "689", Values = digerOlaganDisiGiderZararlar });

        // J TOPLAMI
        var olaganDisiGiderToplam = CalculateTotal(new[] { calismayanKisimGiderZararlari, oncekiDonemGiderZararlari, digerOlaganDisiGiderZararlar }, allPeriods);
        items.Add(new { Name = "J- OLAĞANDIŞI GİDER VE ZARARLAR (-)", IsCategory = true, NotCode = (string?)null, Values = olaganDisiGiderToplam });

        // DÖNEM KARI VEYA ZARARI (hesaplanan: OLAĞAN KAR + I - J)
        var donemKarZarar = CalculateDonemKarZarar(olaganKarZarar, olaganDisiGelirToplam, olaganDisiGiderToplam, allPeriods);
        items.Add(new { Name = "DÖNEM KARI VEYA ZARARI", IsTotal = true, NotCode = (string?)null, Values = donemKarZarar });

        // K- DÖNEM KARI VERGİ VE DİĞER YASAL YÜKÜMLÜLÜK KARŞILIKLARI (-) (691)
        var donemKariVergi = await GetAccountGroupTotal(companyId, year.Value, allPeriods, "691", isNegative: true);
        items.Add(new { Name = "K- DÖNEM KARI VERGİ VE DİĞER YASAL YÜKÜMLÜLÜK KARŞILIKLARI (-)", IsCategory = true, NotCode = "691", Values = donemKariVergi });

        // DÖNEM NET KARI VEYA ZARARI (hesaplanan: DÖNEM KARI - K)
        var donemNetKarZarar = CalculateDifference(donemKarZarar, donemKariVergi, allPeriods);
        items.Add(new { Name = "DÖNEM NET KARI VEYA ZARARI", IsTotal = true, NotCode = (string?)null, Values = donemNetKarZarar });

        return Ok(new
        {
            Year = year.Value,
            Periods = allPeriodsRaw.Select(p => new { p.Year, p.Month }).ToList(),
            Items = items
        });
    }

    private async Task<Dictionary<string, decimal>> GetAccountGroupTotal(
        int companyId,
        int year,
        List<(int Year, int Month)> periods,
        string l1Code,
        bool isNegative = false)
    {
        return await GetAccountGroupTotal(companyId, year, periods, new[] { l1Code }, isNegative);
    }

    private async Task<Dictionary<string, decimal>> GetAccountGroupTotal(
        int companyId,
        int year,
        List<(int Year, int Month)> periods,
        string[] l1Codes,
        bool isNegative = false)
    {
        var values = new Dictionary<string, decimal>();
        decimal total = 0;

        // Yüklenen mizan verilerinden sadece leaf (yaprak) hesapları getir
        var accountsWithBalances = await _context.MonthlyBalances
            .Include(m => m.AccountPlan)
            .Where(m => m.CompanyId == companyId &&
                       m.Year == year &&
                       m.AccountPlan != null &&
                       m.AccountPlan.IsLeaf == true &&
                       l1Codes.Any(code => m.AccountPlan!.AccountCode.StartsWith(code)))
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

        // Her dönem için bakiye hesapla
        foreach (var (periodYear, periodMonth) in periods)
        {
            decimal periodTotal = 0;
            foreach (var accountData in accountsWithBalances)
            {
                var balance = accountData.Balances
                    .Where(b => b.Month == periodMonth)
                    .Sum(b =>
                    {
                        // Gelirler (6 ile başlayan) için: Credit - Debit
                        // Giderler (7 ile başlayan) için: Debit - Credit
                        decimal netBalance;
                        if (l1Codes[0].StartsWith("6"))
                        {
                            netBalance = b.CreditBalance - b.DebitBalance;
                        }
                        else if (l1Codes[0].StartsWith("7"))
                        {
                            netBalance = b.DebitBalance - b.CreditBalance;
                        }
                        else
                        {
                            // Diğer durumlar için varsayılan olarak Credit - Debit
                            netBalance = b.CreditBalance - b.DebitBalance;
                        }

                        // Negatif işaretli kalemler için ters çevir
                        if (isNegative)
                        {
                            netBalance = -Math.Abs(netBalance);
                        }

                        return netBalance;
                    });
                periodTotal += balance;
            }

            var periodKey = $"{periodMonth}";
            values[periodKey] = periodTotal;
            total += periodTotal;
        }

        values["Total"] = total;
        return values;
    }

    private Dictionary<string, decimal> CalculateTotal(
        Dictionary<string, decimal>[] items,
        List<(int Year, int Month)> periods)
    {
        var total = new Dictionary<string, decimal>();

        foreach (var (periodYear, periodMonth) in periods)
        {
            var periodKey = $"{periodMonth}";
            total[periodKey] = items.Sum(item => item.ContainsKey(periodKey) ? item[periodKey] : 0);
        }

        total["Total"] = items.Sum(item => item.ContainsKey("Total") ? item["Total"] : 0);
        return total;
    }

    private Dictionary<string, decimal> CalculateDifference(
        Dictionary<string, decimal> positive,
        Dictionary<string, decimal> negative,
        List<(int Year, int Month)> periods)
    {
        var result = new Dictionary<string, decimal>();

        foreach (var (periodYear, periodMonth) in periods)
        {
            var periodKey = $"{periodMonth}";
            var posValue = positive.ContainsKey(periodKey) ? positive[periodKey] : 0;
            var negValue = negative.ContainsKey(periodKey) ? negative[periodKey] : 0;
            result[periodKey] = posValue - negValue;
        }

        result["Total"] = (positive.ContainsKey("Total") ? positive["Total"] : 0) -
                          (negative.ContainsKey("Total") ? negative["Total"] : 0);
        return result;
    }

    private Dictionary<string, decimal> CalculateOlaganKarZarar(
        Dictionary<string, decimal> faaliyetKarZarar,
        Dictionary<string, decimal> digerGelirler,
        Dictionary<string, decimal> digerGiderler,
        Dictionary<string, decimal> finansmanGiderleri,
        List<(int Year, int Month)> periods)
    {
        var result = new Dictionary<string, decimal>();

        foreach (var (periodYear, periodMonth) in periods)
        {
            var periodKey = $"{periodMonth}";
            var faaliyet = faaliyetKarZarar.ContainsKey(periodKey) ? faaliyetKarZarar[periodKey] : 0;
            var gelir = digerGelirler.ContainsKey(periodKey) ? digerGelirler[periodKey] : 0;
            var gider = digerGiderler.ContainsKey(periodKey) ? digerGiderler[periodKey] : 0;
            var finansman = finansmanGiderleri.ContainsKey(periodKey) ? finansmanGiderleri[periodKey] : 0;
            result[periodKey] = faaliyet + gelir - gider - finansman;
        }

        var faaliyetTotal = faaliyetKarZarar.ContainsKey("Total") ? faaliyetKarZarar["Total"] : 0;
        var gelirTotal = digerGelirler.ContainsKey("Total") ? digerGelirler["Total"] : 0;
        var giderTotal = digerGiderler.ContainsKey("Total") ? digerGiderler["Total"] : 0;
        var finansmanTotal = finansmanGiderleri.ContainsKey("Total") ? finansmanGiderleri["Total"] : 0;
        result["Total"] = faaliyetTotal + gelirTotal - giderTotal - finansmanTotal;

        return result;
    }

    private Dictionary<string, decimal> CalculateDonemKarZarar(
        Dictionary<string, decimal> olaganKarZarar,
        Dictionary<string, decimal> olaganDisiGelirler,
        Dictionary<string, decimal> olaganDisiGiderler,
        List<(int Year, int Month)> periods)
    {
        var result = new Dictionary<string, decimal>();

        foreach (var (periodYear, periodMonth) in periods)
        {
            var periodKey = $"{periodMonth}";
            var olagan = olaganKarZarar.ContainsKey(periodKey) ? olaganKarZarar[periodKey] : 0;
            var gelir = olaganDisiGelirler.ContainsKey(periodKey) ? olaganDisiGelirler[periodKey] : 0;
            var gider = olaganDisiGiderler.ContainsKey(periodKey) ? olaganDisiGiderler[periodKey] : 0;
            result[periodKey] = olagan + gelir - gider;
        }

        var olaganTotal = olaganKarZarar.ContainsKey("Total") ? olaganKarZarar["Total"] : 0;
        var gelirTotal = olaganDisiGelirler.ContainsKey("Total") ? olaganDisiGelirler["Total"] : 0;
        var giderTotal = olaganDisiGiderler.ContainsKey("Total") ? olaganDisiGiderler["Total"] : 0;
        result["Total"] = olaganTotal + gelirTotal - giderTotal;

        return result;
    }
}
