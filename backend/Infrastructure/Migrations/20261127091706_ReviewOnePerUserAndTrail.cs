using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ReviewOnePerUserAndTrail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Reviews_TrailId",
                schema: "dbo",
                table: "Reviews");

            migrationBuilder.Sql("""
            delete from dbo."Reviews" r
            using dbo."Reviews" newer
            where r."UserId" is not null
              and newer."UserId" = r."UserId"
              and newer."TrailId" = r."TrailId"
              and (newer."CreatedAt", newer."Id") > (r."CreatedAt", r."Id");
            """);

            migrationBuilder.CreateIndex(
                name: "IX_Reviews_TrailId_UserId",
                schema: "dbo",
                table: "Reviews",
                columns: new[] { "TrailId", "UserId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Reviews_TrailId_UserId",
                schema: "dbo",
                table: "Reviews");

            migrationBuilder.CreateIndex(
                name: "IX_Reviews_TrailId",
                schema: "dbo",
                table: "Reviews",
                column: "TrailId");
        }
    }
}
