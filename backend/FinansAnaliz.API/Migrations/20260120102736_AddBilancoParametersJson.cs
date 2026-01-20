using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinansAnaliz.API.Migrations
{
    /// <inheritdoc />
    public partial class AddBilancoParametersJson : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BilancoParametersJson",
                table: "Companies",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BilancoParametersJson",
                table: "Companies");
        }
    }
}
