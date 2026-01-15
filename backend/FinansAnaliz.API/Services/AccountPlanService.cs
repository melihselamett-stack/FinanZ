using Microsoft.EntityFrameworkCore;
using FinansAnaliz.API.Data;
using FinansAnaliz.API.Models;

namespace FinansAnaliz.API.Services;

public class AccountPlanService : IAccountPlanService
{
    private readonly ApplicationDbContext _context;

    public AccountPlanService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<AccountPlan>> GetByCompanyIdAsync(int companyId)
    {
        return await _context.AccountPlans
            .Where(a => a.CompanyId == companyId)
            .OrderBy(a => a.AccountCode)
            .ToListAsync();
    }

    public async Task<AccountPlan?> GetByIdAsync(int id)
    {
        return await _context.AccountPlans.FindAsync(id);
    }

    public async Task<AccountPlan> CreateAsync(AccountPlan accountPlan)
    {
        _context.AccountPlans.Add(accountPlan);
        await _context.SaveChangesAsync();
        return accountPlan;
    }

    public async Task UpdateAsync(AccountPlan accountPlan)
    {
        _context.AccountPlans.Update(accountPlan);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(int id)
    {
        var accountPlan = await _context.AccountPlans.FindAsync(id);
        if (accountPlan != null)
        {
            _context.AccountPlans.Remove(accountPlan);
            await _context.SaveChangesAsync();
        }
    }

    public async Task CalculatePropertiesAsync(int companyId)
    {
        var company = await _context.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId);
        if (company == null) return;

        var separator = company.AccountCodeSeparator;
        var accounts = await _context.AccountPlans
            .Where(a => a.CompanyId == companyId)
            .OrderBy(a => a.AccountCode)
            .ToListAsync();

        if (!accounts.Any()) return;

        var accountIndex = new Dictionary<string, int>();
        for (int i = 0; i < accounts.Count; i++)
        {
            accountIndex[accounts[i].AccountCode] = i;
        }

        for (int i = 0; i < accounts.Count; i++)
        {
            var account = accounts[i];
            var separatorCount = account.AccountCode.Count(c => c.ToString() == separator);
            account.Level = separatorCount + 1;

            var properties = new string?[5];
            
            // Önce doğrudan üst hesabın property'lerini miras al
            var codeParts = account.AccountCode.Split(separator[0]);
            if (codeParts.Length > 1)
            {
                var parentCodeFull = string.Join(separator, codeParts.Take(codeParts.Length - 1));
                if (accountIndex.TryGetValue(parentCodeFull, out var parentIdx))
                {
                    var parent = accounts[parentIdx];
                    properties[0] = parent.Property1;
                    properties[1] = parent.Property2;
                    properties[2] = parent.Property3;
                    properties[3] = parent.Property4;
                    properties[4] = parent.Property5;
                    account.ParentId = parent.Id;
                }
            }
            
            // Kendi özellik atamasını belirle ve yaz
            int targetPropertyIndex = account.AssignedPropertyIndex.HasValue && account.AssignedPropertyIndex.Value >= 1 && account.AssignedPropertyIndex.Value <= 5
                ? account.AssignedPropertyIndex.Value - 1
                : account.Level - 1;
            
            if (targetPropertyIndex < 5)
            {
                // Özel değer varsa onu kullan, yoksa hesap adını kullan
                properties[targetPropertyIndex] = !string.IsNullOrEmpty(account.AssignedPropertyValue) 
                    ? account.AssignedPropertyValue 
                    : account.AccountName;
            }

            // IsLeaf kontrolü
            bool isLeaf = true;
            if (i < accounts.Count - 1)
            {
                var nextAccount = accounts[i + 1];
                if (nextAccount.AccountCode.StartsWith(account.AccountCode + separator))
                {
                    isLeaf = false;
                }
            }
            account.IsLeaf = isLeaf;

            // Leaf hesaplarda boş özellikleri son değerle doldur
            if (isLeaf)
            {
                string? lastValue = null;
                for (int k = 0; k < 5; k++)
                {
                    if (properties[k] != null)
                        lastValue = properties[k];
                    else if (lastValue != null)
                        properties[k] = lastValue;
                }
            }

            account.Property1 = properties[0];
            account.Property2 = properties[1];
            account.Property3 = properties[2];
            account.Property4 = properties[3];
            account.Property5 = properties[4];
        }

        await _context.SaveChangesAsync();
    }

    public async Task AssignPropertyAsync(int accountId, int? propertyIndex, string? propertyValue)
    {
        var account = await _context.AccountPlans.FindAsync(accountId);
        if (account == null) return;
        
        account.AssignedPropertyIndex = propertyIndex;
        account.AssignedPropertyValue = propertyValue;
        await _context.SaveChangesAsync();
        
        // Atama sonrası otomatik hesaplama yap
        await CalculatePropertiesAsync(account.CompanyId);
    }
}
