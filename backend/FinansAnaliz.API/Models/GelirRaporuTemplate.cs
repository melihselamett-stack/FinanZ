namespace FinansAnaliz.API.Models;

public class GelirRaporuTemplate
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string TemplateName { get; set; } = string.Empty;
    public string GroupsJson { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public virtual Company? Company { get; set; }
    public virtual ApplicationUser? User { get; set; }
}
