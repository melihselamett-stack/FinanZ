namespace FinansAnaliz.API.DTOs;

public class BilancoParameterDto
{
    public string NotCode { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public List<string> AccountCodePrefixes { get; set; } = new List<string>();
}

public class CompanyRequest
{
    public string CompanyName { get; set; } = string.Empty;
    public string TaxNumber { get; set; } = string.Empty;
    public string AccountCodeSeparator { get; set; } = ".";
}

public class CompanyResponse
{
    public int Id { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string TaxNumber { get; set; } = string.Empty;
    public string AccountCodeSeparator { get; set; } = ".";
    public DateTime CreatedAt { get; set; }
    public string? PropertyName1 { get; set; }
    public string? PropertyName2 { get; set; }
    public string? PropertyName3 { get; set; }
    public string? PropertyName4 { get; set; }
    public string? PropertyName5 { get; set; }
}

public class PropertyOptionResponse
{
    public int Id { get; set; }
    public int PropertyIndex { get; set; }
    public string Value { get; set; } = string.Empty;
}

public class PropertyNamesRequest
{
    public string? PropertyName1 { get; set; }
    public string? PropertyName2 { get; set; }
    public string? PropertyName3 { get; set; }
    public string? PropertyName4 { get; set; }
    public string? PropertyName5 { get; set; }
}

public class PropertyOptionRequest
{
    public int PropertyIndex { get; set; }
    public string Value { get; set; } = string.Empty;
}

