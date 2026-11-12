using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CityAreaMunicipality : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MunicipalityId",
                schema: "dbo",
                table: "CityAreas",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_CityAreas_MunicipalityId",
                schema: "dbo",
                table: "CityAreas",
                column: "MunicipalityId");

            migrationBuilder.AddForeignKey(
                name: "FK_CityAreas_Municipalities_MunicipalityId",
                schema: "dbo",
                table: "CityAreas",
                column: "MunicipalityId",
                principalSchema: "dbo",
                principalTable: "Municipalities",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // keep-comment: every area so far comes from Borås' outdoor pages; stays null where that municipality is missing
            migrationBuilder.Sql("""
                UPDATE dbo."CityAreas"
                SET "MunicipalityId" = (SELECT "Id" FROM dbo."Municipalities" WHERE "Slug" = 'boras')
                WHERE "MunicipalityId" IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CityAreas_Municipalities_MunicipalityId",
                schema: "dbo",
                table: "CityAreas");

            migrationBuilder.DropIndex(
                name: "IX_CityAreas_MunicipalityId",
                schema: "dbo",
                table: "CityAreas");

            migrationBuilder.DropColumn(
                name: "MunicipalityId",
                schema: "dbo",
                table: "CityAreas");
        }
    }
}
