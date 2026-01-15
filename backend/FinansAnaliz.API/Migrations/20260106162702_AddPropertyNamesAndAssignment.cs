using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinansAnaliz.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPropertyNamesAndAssignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PropertyName1",
                table: "Companies",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PropertyName2",
                table: "Companies",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PropertyName3",
                table: "Companies",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PropertyName4",
                table: "Companies",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PropertyName5",
                table: "Companies",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AssignedPropertyIndex",
                table: "AccountPlans",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PropertyName1",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "PropertyName2",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "PropertyName3",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "PropertyName4",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "PropertyName5",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "AssignedPropertyIndex",
                table: "AccountPlans");
        }
    }
}
