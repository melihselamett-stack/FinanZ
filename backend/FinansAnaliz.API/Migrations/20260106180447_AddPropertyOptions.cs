using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinansAnaliz.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPropertyOptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PropertyOptions1",
                table: "Companies",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PropertyOptions2",
                table: "Companies",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PropertyOptions3",
                table: "Companies",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PropertyOptions4",
                table: "Companies",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PropertyOptions5",
                table: "Companies",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PropertyOptions1",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "PropertyOptions2",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "PropertyOptions3",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "PropertyOptions4",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "PropertyOptions5",
                table: "Companies");
        }
    }
}
