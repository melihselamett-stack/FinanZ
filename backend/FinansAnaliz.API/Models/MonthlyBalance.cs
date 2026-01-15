namespace FinansAnaliz.API.Models;

public class MonthlyBalance
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int AccountPlanId { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public decimal DebitBalance { get; set; }
    public decimal CreditBalance { get; set; }
    
    public virtual Company? Company { get; set; }
    public virtual AccountPlan? AccountPlan { get; set; }
}

