using FinansAnaliz.API.DTOs;

namespace FinansAnaliz.API.Services;

public interface IMizanService
{
    Task<MizanUploadResult> UploadMizanAsync(int companyId, int year, int month, Stream excelStream);
}


