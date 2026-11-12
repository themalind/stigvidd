using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FacilitySource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SourceId",
                schema: "dbo",
                table: "Facilities",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceSnapshot",
                schema: "dbo",
                table: "Facilities",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Facilities_SourceId",
                schema: "dbo",
                table: "Facilities",
                column: "SourceId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Facilities_SourceId",
                schema: "dbo",
                table: "Facilities");

            migrationBuilder.DropColumn(
                name: "SourceId",
                schema: "dbo",
                table: "Facilities");

            migrationBuilder.DropColumn(
                name: "SourceSnapshot",
                schema: "dbo",
                table: "Facilities");
        }
    }
}
