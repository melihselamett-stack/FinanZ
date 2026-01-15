using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using FinansAnaliz.API.Data;
using FinansAnaliz.API.Models;
using FinansAnaliz.API.DTOs;
using FinansAnaliz.API.Services;

namespace FinansAnaliz.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AccountPlanController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAccountPlanService _accountPlanService;

    public AccountPlanController(ApplicationDbContext context, IAccountPlanService accountPlanService)
    {
        _context = context;
        _accountPlanService = accountPlanService;
    }

    private string GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    private async Task<bool> UserOwnsCompany(int companyId)
    {
        var userId = GetUserId();
        return await _context.Companies.AnyAsync(c => c.Id == companyId && c.UserId == userId);
    }

    [HttpGet("company/{companyId}")]
    public async Task<ActionResult<List<AccountPlanResponse>>> GetByCompany(int companyId)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        var accounts = await _accountPlanService.GetByCompanyIdAsync(companyId);
        
        return Ok(accounts.Select(a => new AccountPlanResponse
        {
            Id = a.Id,
            AccountCode = a.AccountCode,
            AccountName = a.AccountName,
            Level = a.Level,
            Property1 = a.Property1,
            Property2 = a.Property2,
            Property3 = a.Property3,
            Property4 = a.Property4,
            Property5 = a.Property5,
            CostCenter = a.CostCenter,
            IsLeaf = a.IsLeaf,
            AssignedPropertyIndex = a.AssignedPropertyIndex,
            AssignedPropertyValue = a.AssignedPropertyValue
        }).ToList());
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<AccountPlanResponse>> GetById(int id)
    {
        var account = await _accountPlanService.GetByIdAsync(id);
        if (account == null)
            return NotFound();

        if (!await UserOwnsCompany(account.CompanyId))
            return Forbid();

        return Ok(new AccountPlanResponse
        {
            Id = account.Id,
            AccountCode = account.AccountCode,
            AccountName = account.AccountName,
            Level = account.Level,
            Property1 = account.Property1,
            Property2 = account.Property2,
            Property3 = account.Property3,
            Property4 = account.Property4,
            Property5 = account.Property5,
            CostCenter = account.CostCenter,
            IsLeaf = account.IsLeaf,
            AssignedPropertyIndex = account.AssignedPropertyIndex,
            AssignedPropertyValue = account.AssignedPropertyValue
        });
    }

    [HttpPost("company/{companyId}")]
    public async Task<ActionResult<AccountPlanResponse>> Create(int companyId, [FromBody] AccountPlanRequest request)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        var existing = await _context.AccountPlans
            .FirstOrDefaultAsync(a => a.CompanyId == companyId && a.AccountCode == request.AccountCode);
        
        if (existing != null)
            return BadRequest("Bu hesap kodu zaten mevcut");

        var account = new AccountPlan
        {
            CompanyId = companyId,
            AccountCode = request.AccountCode,
            AccountName = request.AccountName,
            CostCenter = request.CostCenter
        };

        await _accountPlanService.CreateAsync(account);
        await _accountPlanService.CalculatePropertiesAsync(companyId);

        return CreatedAtAction(nameof(GetById), new { id = account.Id }, new AccountPlanResponse
        {
            Id = account.Id,
            AccountCode = account.AccountCode,
            AccountName = account.AccountName,
            Level = account.Level,
            Property1 = account.Property1,
            Property2 = account.Property2,
            Property3 = account.Property3,
            Property4 = account.Property4,
            Property5 = account.Property5,
            CostCenter = account.CostCenter,
            IsLeaf = account.IsLeaf,
            AssignedPropertyIndex = account.AssignedPropertyIndex,
            AssignedPropertyValue = account.AssignedPropertyValue
        });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] AccountPlanRequest request)
    {
        var account = await _accountPlanService.GetByIdAsync(id);
        if (account == null)
            return NotFound();

        if (!await UserOwnsCompany(account.CompanyId))
            return Forbid();

        account.AccountCode = request.AccountCode;
        account.AccountName = request.AccountName;
        account.CostCenter = request.CostCenter;

        await _accountPlanService.UpdateAsync(account);
        await _accountPlanService.CalculatePropertiesAsync(account.CompanyId);

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var account = await _accountPlanService.GetByIdAsync(id);
        if (account == null)
            return NotFound();

        if (!await UserOwnsCompany(account.CompanyId))
            return Forbid();

        var companyId = account.CompanyId;
        await _accountPlanService.DeleteAsync(id);
        await _accountPlanService.CalculatePropertiesAsync(companyId);

        return NoContent();
    }

    [HttpPost("company/{companyId}/recalculate")]
    public async Task<IActionResult> RecalculateProperties(int companyId)
    {
        if (!await UserOwnsCompany(companyId))
            return Forbid();

        await _accountPlanService.CalculatePropertiesAsync(companyId);
        return Ok();
    }

    [HttpPut("{id}/assign-property")]
    public async Task<IActionResult> AssignProperty(int id, [FromBody] AssignPropertyRequest request)
    {
        var account = await _accountPlanService.GetByIdAsync(id);
        if (account == null)
            return NotFound();

        if (!await UserOwnsCompany(account.CompanyId))
            return Forbid();

        await _accountPlanService.AssignPropertyAsync(id, request.PropertyIndex, request.PropertyValue);
        return NoContent();
    }
}

