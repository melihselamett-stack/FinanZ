namespace FinansAnaliz.API.DTOs;

public class AccountPlanRequest
{
    public string AccountCode { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string? CostCenter { get; set; }
}

public class AccountPlanResponse
{
    public int Id { get; set; }
    public string AccountCode { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
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
}

public class AssignPropertyRequest
{
    public int? PropertyIndex { get; set; }
    public string? PropertyValue { get; set; }
}

