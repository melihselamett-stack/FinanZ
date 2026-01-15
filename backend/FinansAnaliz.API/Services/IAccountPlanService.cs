using FinansAnaliz.API.Models;

namespace FinansAnaliz.API.Services;

public interface IAccountPlanService
{
    Task<List<AccountPlan>> GetByCompanyIdAsync(int companyId);
    Task<AccountPlan?> GetByIdAsync(int id);
    Task<AccountPlan> CreateAsync(AccountPlan accountPlan);
    Task UpdateAsync(AccountPlan accountPlan);
    Task DeleteAsync(int id);
    Task CalculatePropertiesAsync(int companyId);
    Task AssignPropertyAsync(int accountId, int? propertyIndex, string? propertyValue);
}

