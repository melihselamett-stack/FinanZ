namespace FinansAnaliz.API.Models;

public class Company
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string TaxNumber { get; set; } = string.Empty;
    public string AccountCodeSeparator { get; set; } = ".";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public string? PropertyName1 { get; set; }
    public string? PropertyName2 { get; set; }
    public string? PropertyName3 { get; set; }
    public string? PropertyName4 { get; set; }
    public string? PropertyName5 { get; set; }
    
    public string? BilancoParametersJson { get; set; } // JSON formatında bilanço parametreleri
    
    public virtual ApplicationUser? User { get; set; }
    public virtual ICollection<PropertyOption> PropertyOptions { get; set; } = new List<PropertyOption>();
    public virtual ICollection<AccountPlan> AccountPlans { get; set; } = new List<AccountPlan>();
    public virtual ICollection<MonthlyBalance> MonthlyBalances { get; set; } = new List<MonthlyBalance>();
}

