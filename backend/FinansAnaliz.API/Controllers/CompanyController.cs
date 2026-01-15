using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using FinansAnaliz.API.Data;
using FinansAnaliz.API.Models;
using FinansAnaliz.API.DTOs;

namespace FinansAnaliz.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CompanyController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public CompanyController(ApplicationDbContext context)
    {
        _context = context;
    }

    private string GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<ActionResult<List<CompanyResponse>>> GetCompanies()
    {
        var userId = GetUserId();
        var companies = await _context.Companies
            .Where(c => c.UserId == userId)
            .Select(c => new CompanyResponse
            {
                Id = c.Id,
                CompanyName = c.CompanyName,
                TaxNumber = c.TaxNumber,
                AccountCodeSeparator = c.AccountCodeSeparator,
                CreatedAt = c.CreatedAt,
                PropertyName1 = c.PropertyName1,
                PropertyName2 = c.PropertyName2,
                PropertyName3 = c.PropertyName3,
                PropertyName4 = c.PropertyName4,
                PropertyName5 = c.PropertyName5
            })
            .ToListAsync();

        return Ok(companies);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<CompanyResponse>> GetCompany(int id)
    {
        var userId = GetUserId();
        var company = await _context.Companies
            .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId);

        if (company == null)
            return NotFound();

        return Ok(new CompanyResponse
        {
            Id = company.Id,
            CompanyName = company.CompanyName,
            TaxNumber = company.TaxNumber,
            AccountCodeSeparator = company.AccountCodeSeparator,
            CreatedAt = company.CreatedAt,
            PropertyName1 = company.PropertyName1,
            PropertyName2 = company.PropertyName2,
            PropertyName3 = company.PropertyName3,
            PropertyName4 = company.PropertyName4,
            PropertyName5 = company.PropertyName5
        });
    }

    [HttpPost]
    public async Task<ActionResult<CompanyResponse>> CreateCompany([FromBody] CompanyRequest request)
    {
        var userId = GetUserId();
        
        var existingCompany = await _context.Companies
            .FirstOrDefaultAsync(c => c.UserId == userId && c.TaxNumber == request.TaxNumber);
        
        if (existingCompany != null)
            return BadRequest("Bu vergi numarasına sahip bir şirket zaten mevcut");

        var company = new Company
        {
            UserId = userId,
            CompanyName = request.CompanyName,
            TaxNumber = request.TaxNumber,
            AccountCodeSeparator = request.AccountCodeSeparator,
            CreatedAt = DateTime.UtcNow
        };

        _context.Companies.Add(company);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetCompany), new { id = company.Id }, new CompanyResponse
        {
            Id = company.Id,
            CompanyName = company.CompanyName,
            TaxNumber = company.TaxNumber,
            AccountCodeSeparator = company.AccountCodeSeparator,
            CreatedAt = company.CreatedAt
        });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateCompany(int id, [FromBody] CompanyRequest request)
    {
        var userId = GetUserId();
        var company = await _context.Companies
            .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId);

        if (company == null)
            return NotFound();

        company.CompanyName = request.CompanyName;
        company.TaxNumber = request.TaxNumber;
        company.AccountCodeSeparator = request.AccountCodeSeparator;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCompany(int id)
    {
        var userId = GetUserId();
        var company = await _context.Companies
            .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId);

        if (company == null)
            return NotFound();

        _context.Companies.Remove(company);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id}/property-names")]
    public async Task<IActionResult> UpdatePropertyNames(int id, [FromBody] PropertyNamesRequest request)
    {
        var userId = GetUserId();
        var company = await _context.Companies
            .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId);

        if (company == null)
            return NotFound();

        company.PropertyName1 = request.PropertyName1;
        company.PropertyName2 = request.PropertyName2;
        company.PropertyName3 = request.PropertyName3;
        company.PropertyName4 = request.PropertyName4;
        company.PropertyName5 = request.PropertyName5;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("{id}/property-options")]
    public async Task<ActionResult<List<PropertyOptionResponse>>> GetPropertyOptions(int id)
    {
        var userId = GetUserId();
        var company = await _context.Companies.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId);
        if (company == null) return NotFound();

        var options = await _context.PropertyOptions
            .Where(p => p.CompanyId == id)
            .OrderBy(p => p.PropertyIndex)
            .ThenBy(p => p.Value)
            .Select(p => new PropertyOptionResponse
            {
                Id = p.Id,
                PropertyIndex = p.PropertyIndex,
                Value = p.Value
            })
            .ToListAsync();

        return Ok(options);
    }

    [HttpPost("{id}/property-options")]
    public async Task<ActionResult<PropertyOptionResponse>> AddPropertyOption(int id, [FromBody] PropertyOptionRequest request)
    {
        var userId = GetUserId();
        var company = await _context.Companies.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId);
        if (company == null) return NotFound();

        if (request.PropertyIndex < 1 || request.PropertyIndex > 5)
            return BadRequest("PropertyIndex 1-5 arasında olmalı");

        var exists = await _context.PropertyOptions
            .AnyAsync(p => p.CompanyId == id && p.PropertyIndex == request.PropertyIndex && p.Value == request.Value);
        if (exists) return BadRequest("Bu değer zaten mevcut");

        var option = new PropertyOption
        {
            CompanyId = id,
            PropertyIndex = request.PropertyIndex,
            Value = request.Value
        };

        _context.PropertyOptions.Add(option);
        await _context.SaveChangesAsync();

        return Ok(new PropertyOptionResponse
        {
            Id = option.Id,
            PropertyIndex = option.PropertyIndex,
            Value = option.Value
        });
    }

    [HttpDelete("{companyId}/property-options/{optionId}")]
    public async Task<IActionResult> DeletePropertyOption(int companyId, int optionId)
    {
        var userId = GetUserId();
        var company = await _context.Companies.FirstOrDefaultAsync(c => c.Id == companyId && c.UserId == userId);
        if (company == null) return NotFound();

        var option = await _context.PropertyOptions.FirstOrDefaultAsync(p => p.Id == optionId && p.CompanyId == companyId);
        if (option == null) return NotFound();

        _context.PropertyOptions.Remove(option);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
