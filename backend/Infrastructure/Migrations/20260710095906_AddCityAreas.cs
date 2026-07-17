using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCityAreas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "Longitude",
                schema: "dbo",
                table: "Facilities",
                type: "numeric(18,5)",
                precision: 18,
                scale: 5,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,5)",
                oldPrecision: 18,
                oldScale: 5);

            migrationBuilder.AlterColumn<decimal>(
                name: "Latitude",
                schema: "dbo",
                table: "Facilities",
                type: "numeric(18,5)",
                precision: 18,
                scale: 5,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,5)",
                oldPrecision: 18,
                oldScale: 5);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                schema: "dbo",
                table: "Facilities",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Location",
                schema: "dbo",
                table: "Facilities",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Url",
                schema: "dbo",
                table: "Facilities",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CityAreas",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Location = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    ImageUrl = table.Column<string>(type: "text", nullable: true),
                    Url = table.Column<string>(type: "text", nullable: true),
                    Identifier = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CityAreas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CityAreaFacility",
                schema: "dbo",
                columns: table => new
                {
                    CityAreaId = table.Column<int>(type: "integer", nullable: false),
                    FacilityId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CityAreaFacility", x => new { x.CityAreaId, x.FacilityId });
                    table.ForeignKey(
                        name: "FK_CityAreaFacility_CityAreas_CityAreaId",
                        column: x => x.CityAreaId,
                        principalSchema: "dbo",
                        principalTable: "CityAreas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CityAreaFacility_Facilities_FacilityId",
                        column: x => x.FacilityId,
                        principalSchema: "dbo",
                        principalTable: "Facilities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CityAreaTrail",
                schema: "dbo",
                columns: table => new
                {
                    CityAreaId = table.Column<int>(type: "integer", nullable: false),
                    TrailId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CityAreaTrail", x => new { x.CityAreaId, x.TrailId });
                    table.ForeignKey(
                        name: "FK_CityAreaTrail_CityAreas_CityAreaId",
                        column: x => x.CityAreaId,
                        principalSchema: "dbo",
                        principalTable: "CityAreas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CityAreaTrail_Trails_TrailId",
                        column: x => x.TrailId,
                        principalSchema: "dbo",
                        principalTable: "Trails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CityAreaFacility_FacilityId",
                schema: "dbo",
                table: "CityAreaFacility",
                column: "FacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_CityAreaTrail_TrailId",
                schema: "dbo",
                table: "CityAreaTrail",
                column: "TrailId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CityAreaFacility",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "CityAreaTrail",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "CityAreas",
                schema: "dbo");

            migrationBuilder.DropColumn(
                name: "Description",
                schema: "dbo",
                table: "Facilities");

            migrationBuilder.DropColumn(
                name: "Location",
                schema: "dbo",
                table: "Facilities");

            migrationBuilder.DropColumn(
                name: "Url",
                schema: "dbo",
                table: "Facilities");

            migrationBuilder.AlterColumn<decimal>(
                name: "Longitude",
                schema: "dbo",
                table: "Facilities",
                type: "numeric(18,5)",
                precision: 18,
                scale: 5,
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,5)",
                oldPrecision: 18,
                oldScale: 5,
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "Latitude",
                schema: "dbo",
                table: "Facilities",
                type: "numeric(18,5)",
                precision: 18,
                scale: 5,
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,5)",
                oldPrecision: 18,
                oldScale: 5,
                oldNullable: true);
        }
    }
}
