namespace FinansAnaliz.API.DTOs;

public class MizanUploadRequest
{
    public int CompanyId { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
}

public class MizanUploadResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public int RowsProcessed { get; set; }
    public int NewAccountsAdded { get; set; }
    public int AccountsUpdated { get; set; }
}

