namespace FinansAnaliz.API.Models;

public class Package
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal MonthlyPrice { get; set; }
    public bool IsActive { get; set; } = true;
    
    public virtual ICollection<UserSubscription> Subscriptions { get; set; } = new List<UserSubscription>();
}

