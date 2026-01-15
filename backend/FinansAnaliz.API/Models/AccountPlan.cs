namespace FinansAnaliz.API.Models;

public class AccountPlan
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string AccountCode { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public int? ParentId { get; set; }
    public int Level { get; set; }
    
    public string? Property1 { get; set; }
    public string? Property2 { get; set; }
    public string? Property3 { get; set; }
    public string? Property4 { get; set; }
    public string? Property5 { get; set; }
    public string? CostCenter { get; set; }
    public bool IsLeaf { get; set; }
    public int? AssignedPropertyIndex { get; set; }
    public string? AssignedPropertyValue { get; set; }
    
    public virtual Company? Company { get; set; }
    public virtual AccountPlan? Parent { get; set; }
    public virtual ICollection<AccountPlan> Children { get; set; } = new List<AccountPlan>();
    public virtual ICollection<MonthlyBalance> MonthlyBalances { get; set; } = new List<MonthlyBalance>();
}

