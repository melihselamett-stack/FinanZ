using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinansAnaliz.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPropertyOptionsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
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

            migrationBuilder.CreateTable(
                name: "PropertyOptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CompanyId = table.Column<int>(type: "int", nullable: false),
                    PropertyIndex = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PropertyOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PropertyOptions_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PropertyOptions_CompanyId_PropertyIndex_Value",
                table: "PropertyOptions",
                columns: new[] { "CompanyId", "PropertyIndex", "Value" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PropertyOptions");

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
    }
}
