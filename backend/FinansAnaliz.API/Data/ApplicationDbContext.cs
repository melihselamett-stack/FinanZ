using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using FinansAnaliz.API.Models;

namespace FinansAnaliz.API.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<Company> Companies { get; set; }
    public DbSet<AccountPlan> AccountPlans { get; set; }
    public DbSet<MonthlyBalance> MonthlyBalances { get; set; }
    public DbSet<Package> Packages { get; set; }
    public DbSet<UserSubscription> UserSubscriptions { get; set; }
    public DbSet<PropertyOption> PropertyOptions { get; set; }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Company>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CompanyName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.TaxNumber).HasMaxLength(20);
            entity.Property(e => e.AccountCodeSeparator).HasMaxLength(5).HasDefaultValue(".");
            
            entity.HasOne(e => e.User)
                .WithMany(u => u.Companies)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasIndex(e => new { e.UserId, e.TaxNumber }).IsUnique();
        });

        builder.Entity<AccountPlan>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.AccountCode).IsRequired().HasMaxLength(50);
            entity.Property(e => e.AccountName).IsRequired().HasMaxLength(300);
            entity.Property(e => e.Property1).HasMaxLength(300);
            entity.Property(e => e.Property2).HasMaxLength(300);
            entity.Property(e => e.Property3).HasMaxLength(300);
            entity.Property(e => e.Property4).HasMaxLength(300);
            entity.Property(e => e.Property5).HasMaxLength(300);
            entity.Property(e => e.CostCenter).HasMaxLength(100);
            
            entity.HasOne(e => e.Company)
                .WithMany(c => c.AccountPlans)
                .HasForeignKey(e => e.CompanyId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasOne(e => e.Parent)
                .WithMany(p => p.Children)
                .HasForeignKey(e => e.ParentId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasIndex(e => new { e.CompanyId, e.AccountCode }).IsUnique();
        });

        builder.Entity<MonthlyBalance>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Debit).HasPrecision(18, 2);
            entity.Property(e => e.Credit).HasPrecision(18, 2);
            entity.Property(e => e.DebitBalance).HasPrecision(18, 2);
            entity.Property(e => e.CreditBalance).HasPrecision(18, 2);
            
            entity.HasOne(e => e.Company)
                .WithMany(c => c.MonthlyBalances)
                .HasForeignKey(e => e.CompanyId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasOne(e => e.AccountPlan)
                .WithMany(a => a.MonthlyBalances)
                .HasForeignKey(e => e.AccountPlanId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasIndex(e => new { e.CompanyId, e.AccountPlanId, e.Year, e.Month }).IsUnique();
        });

        builder.Entity<PropertyOption>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Value).IsRequired().HasMaxLength(200);
            
            entity.HasOne(e => e.Company)
                .WithMany(c => c.PropertyOptions)
                .HasForeignKey(e => e.CompanyId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasIndex(e => new { e.CompanyId, e.PropertyIndex, e.Value }).IsUnique();
        });

        builder.Entity<Package>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.MonthlyPrice).HasPrecision(18, 2);
        });

        builder.Entity<UserSubscription>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            entity.HasOne(e => e.User)
                .WithOne(u => u.Subscription)
                .HasForeignKey<UserSubscription>(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasOne(e => e.Package)
                .WithMany(p => p.Subscriptions)
                .HasForeignKey(e => e.PackageId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        SeedData(builder);
    }

    private void SeedData(ModelBuilder builder)
    {
        builder.Entity<Package>().HasData(
            new Package
            {
                Id = 1,
                Name = "Temel Paket",
                Description = "Tüm temel raporlara erişim",
                MonthlyPrice = 299.00m,
                IsActive = true
            }
        );
    }
}

