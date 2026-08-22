using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProposalDecidedNameAndLength : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "DecidedLengthKm",
                schema: "dbo",
                table: "TrailImportProposals",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DecidedName",
                schema: "dbo",
                table: "TrailImportProposals",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DecidedLengthKm",
                schema: "dbo",
                table: "TrailImportProposals");

            migrationBuilder.DropColumn(
                name: "DecidedName",
                schema: "dbo",
                table: "TrailImportProposals");
        }
    }
}
