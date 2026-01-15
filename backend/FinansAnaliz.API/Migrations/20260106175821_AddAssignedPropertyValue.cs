using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinansAnaliz.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAssignedPropertyValue : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AssignedPropertyValue",
                table: "AccountPlans",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AssignedPropertyValue",
                table: "AccountPlans");
        }
    }
}
