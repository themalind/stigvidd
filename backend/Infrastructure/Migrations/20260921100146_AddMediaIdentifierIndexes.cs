using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMediaIdentifierIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Trails_Identifier",
                schema: "dbo",
                table: "Trails",
                column: "Identifier",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TrailImages_Identifier",
                schema: "dbo",
                table: "TrailImages",
                column: "Identifier",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FacilityImages_Identifier",
                schema: "dbo",
                table: "FacilityImages",
                column: "Identifier",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Trails_Identifier",
                schema: "dbo",
                table: "Trails");

            migrationBuilder.DropIndex(
                name: "IX_TrailImages_Identifier",
                schema: "dbo",
                table: "TrailImages");

            migrationBuilder.DropIndex(
                name: "IX_FacilityImages_Identifier",
                schema: "dbo",
                table: "FacilityImages");
        }
    }
}
