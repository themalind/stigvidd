using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FacilityImportSources : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FacilityImportSources",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MunicipalityId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Slug = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Key = table.Column<string>(type: "character varying(101)", maxLength: 101, nullable: false),
                    Mapping = table.Column<string>(type: "text", nullable: true),
                    Identifier = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilityImportSources", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FacilityImportSources_Municipalities_MunicipalityId",
                        column: x => x.MunicipalityId,
                        principalSchema: "dbo",
                        principalTable: "Municipalities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FacilityImportSources_Identifier",
                schema: "dbo",
                table: "FacilityImportSources",
                column: "Identifier",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FacilityImportSources_Key",
                schema: "dbo",
                table: "FacilityImportSources",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FacilityImportSources_MunicipalityId_Name",
                schema: "dbo",
                table: "FacilityImportSources",
                columns: new[] { "MunicipalityId", "Name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FacilityImportSources",
                schema: "dbo");
        }
    }
}
