using Microsoft.AspNetCore.Identity;

namespace FinansAnaliz.API.Models;

public class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public virtual ICollection<Company> Companies { get; set; } = new List<Company>();
    public virtual UserSubscription? Subscription { get; set; }
}

