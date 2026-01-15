namespace FinansAnaliz.API.Models;

public class PropertyOption
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int PropertyIndex { get; set; }
    public string Value { get; set; } = string.Empty;
    
    public virtual Company? Company { get; set; }
}

