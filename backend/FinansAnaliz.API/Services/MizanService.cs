using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using FinansAnaliz.API.Data;
using FinansAnaliz.API.Models;
using FinansAnaliz.API.DTOs;

namespace FinansAnaliz.API.Services;

public class MizanService : IMizanService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccountPlanService _accountPlanService;

    public MizanService(ApplicationDbContext context, IAccountPlanService accountPlanService)
    {
        _context = context;
        _accountPlanService = accountPlanService;
    }

    public async Task<MizanUploadResult> UploadMizanAsync(int companyId, int year, int month, Stream excelStream)
    {
        var result = new MizanUploadResult();
        var company = await _context.Companies.FindAsync(companyId);
        if (company == null)
        {
            result.Success = false;
            result.ErrorMessage = "Şirket bulunamadı";
            return result;
        }

        using var workbook = new XLWorkbook(excelStream);
        var worksheet = workbook.Worksheets.First();
        var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 0;

        // Mevcut hesap planlarını dictionary olarak al (hızlı lookup için)
        var existingAccounts = await _context.AccountPlans
            .Where(a => a.CompanyId == companyId)
            .ToDictionaryAsync(a => a.AccountCode, a => a);

        // Mevcut ay verilerini sil
        var existingBalances = await _context.MonthlyBalances
            .Where(m => m.CompanyId == companyId && m.Year == year && m.Month == month)
            .ToListAsync();
        
        if (existingBalances.Any())
        {
            _context.MonthlyBalances.RemoveRange(existingBalances);
            await _context.SaveChangesAsync();
        }

        // Excel verilerini parse et
        var parsedRows = new List<MizanRow>();
        for (int row = 2; row <= lastRow; row++)
        {
            var accountCode = worksheet.Cell(row, 1).GetString().Trim();
            if (string.IsNullOrEmpty(accountCode)) continue;

            parsedRows.Add(new MizanRow
            {
                AccountCode = accountCode,
                AccountName = worksheet.Cell(row, 2).GetString().Trim(),
                Debit = ParseTurkishDecimal(worksheet.Cell(row, 3).GetString()),
                Credit = ParseTurkishDecimal(worksheet.Cell(row, 4).GetString()),
                DebitBalance = ParseTurkishDecimal(worksheet.Cell(row, 5).GetString()),
                CreditBalance = ParseTurkishDecimal(worksheet.Cell(row, 6).GetString()),
                CostCenter = worksheet.Cell(row, 8).GetString().Trim()
            });
        }

        // Yeni hesapları bulk ekle
        var newAccounts = new List<AccountPlan>();
        var accountsToUpdate = new List<AccountPlan>();

        foreach (var row in parsedRows)
        {
            if (existingAccounts.TryGetValue(row.AccountCode, out var existing))
            {
                if (existing.AccountName != row.AccountName)
                {
                    existing.AccountName = row.AccountName;
                    if (!string.IsNullOrEmpty(row.CostCenter))
                        existing.CostCenter = row.CostCenter;
                    accountsToUpdate.Add(existing);
                }
            }
            else
            {
                var newAccount = new AccountPlan
                {
                    CompanyId = companyId,
                    AccountCode = row.AccountCode,
                    AccountName = row.AccountName,
                    CostCenter = row.CostCenter
                };
                newAccounts.Add(newAccount);
                existingAccounts[row.AccountCode] = newAccount;
            }
        }

        // Bulk insert yeni hesaplar
        if (newAccounts.Any())
        {
            await _context.AccountPlans.AddRangeAsync(newAccounts);
            await _context.SaveChangesAsync();
            result.NewAccountsAdded = newAccounts.Count;
        }

        result.AccountsUpdated = accountsToUpdate.Count;
        if (accountsToUpdate.Any())
        {
            await _context.SaveChangesAsync();
        }

        // Hesap ID'lerini yeniden al (yeni eklenenler için ID gerekli)
        var accountDict = await _context.AccountPlans
            .Where(a => a.CompanyId == companyId)
            .ToDictionaryAsync(a => a.AccountCode, a => a.Id);

        // Bulk insert aylık bakiyeler
        var monthlyBalances = parsedRows
            .Where(row => accountDict.ContainsKey(row.AccountCode))
            .Select(row => new MonthlyBalance
            {
                CompanyId = companyId,
                AccountPlanId = accountDict[row.AccountCode],
                Year = year,
                Month = month,
                Debit = row.Debit,
                Credit = row.Credit,
                DebitBalance = row.DebitBalance,
                CreditBalance = row.CreditBalance
            })
            .ToList();

        await _context.MonthlyBalances.AddRangeAsync(monthlyBalances);
        await _context.SaveChangesAsync();
        
        result.RowsProcessed = monthlyBalances.Count;

        // 5 Özellik hesapla
        await _accountPlanService.CalculatePropertiesAsync(companyId);

        result.Success = true;
        return result;
    }

    private decimal ParseTurkishDecimal(string value)
    {
        if (string.IsNullOrWhiteSpace(value) || value == "-")
            return 0;

        // Türkçe format: 1.234.567,89
        value = value.Replace(".", "").Replace(",", ".");
        if (decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var result))
            return result;

        return 0;
    }

    private class MizanRow
    {
        public string AccountCode { get; set; } = "";
        public string AccountName { get; set; } = "";
        public decimal Debit { get; set; }
        public decimal Credit { get; set; }
        public decimal DebitBalance { get; set; }
        public decimal CreditBalance { get; set; }
        public string CostCenter { get; set; } = "";
    }
}
