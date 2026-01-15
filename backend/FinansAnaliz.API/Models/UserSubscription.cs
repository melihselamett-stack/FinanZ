namespace FinansAnaliz.API.Models;

public class UserSubscription
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public int PackageId { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool IsActive { get; set; } = true;
    
    public virtual ApplicationUser? User { get; set; }
    public virtual Package? Package { get; set; }
}

