using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CityAreaBoundary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsManual",
                schema: "dbo",
                table: "CityAreaTrail",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<MultiPolygon>(
                name: "Boundary",
                schema: "dbo",
                table: "CityAreas",
                type: "geometry(MultiPolygon, 4326)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsManual",
                schema: "dbo",
                table: "CityAreaFacility",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // keep-comment: links made by hand before boundaries existed survive a recalculation
            migrationBuilder.Sql("UPDATE dbo.\"CityAreaTrail\" SET \"IsManual\" = true;");
            migrationBuilder.Sql("UPDATE dbo.\"CityAreaFacility\" SET \"IsManual\" = true;");

            migrationBuilder.CreateTable(
                name: "CityAreaFacilityExclusions",
                schema: "dbo",
                columns: table => new
                {
                    CityAreaId = table.Column<int>(type: "integer", nullable: false),
                    FacilityId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CityAreaFacilityExclusions", x => new { x.CityAreaId, x.FacilityId });
                    table.ForeignKey(
                        name: "FK_CityAreaFacilityExclusions_CityAreas_CityAreaId",
                        column: x => x.CityAreaId,
                        principalSchema: "dbo",
                        principalTable: "CityAreas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CityAreaFacilityExclusions_Facilities_FacilityId",
                        column: x => x.FacilityId,
                        principalSchema: "dbo",
                        principalTable: "Facilities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CityAreaTrailExclusions",
                schema: "dbo",
                columns: table => new
                {
                    CityAreaId = table.Column<int>(type: "integer", nullable: false),
                    TrailId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CityAreaTrailExclusions", x => new { x.CityAreaId, x.TrailId });
                    table.ForeignKey(
                        name: "FK_CityAreaTrailExclusions_CityAreas_CityAreaId",
                        column: x => x.CityAreaId,
                        principalSchema: "dbo",
                        principalTable: "CityAreas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CityAreaTrailExclusions_Trails_TrailId",
                        column: x => x.TrailId,
                        principalSchema: "dbo",
                        principalTable: "Trails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Trails_GeoPath",
                schema: "dbo",
                table: "Trails",
                column: "GeoPath")
                .Annotation("Npgsql:IndexMethod", "gist");

            migrationBuilder.CreateIndex(
                name: "IX_CityAreas_Boundary",
                schema: "dbo",
                table: "CityAreas",
                column: "Boundary")
                .Annotation("Npgsql:IndexMethod", "gist");

            migrationBuilder.CreateIndex(
                name: "IX_CityAreaFacilityExclusions_FacilityId",
                schema: "dbo",
                table: "CityAreaFacilityExclusions",
                column: "FacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_CityAreaTrailExclusions_TrailId",
                schema: "dbo",
                table: "CityAreaTrailExclusions",
                column: "TrailId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CityAreaFacilityExclusions",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "CityAreaTrailExclusions",
                schema: "dbo");

            migrationBuilder.DropIndex(
                name: "IX_Trails_GeoPath",
                schema: "dbo",
                table: "Trails");

            migrationBuilder.DropIndex(
                name: "IX_CityAreas_Boundary",
                schema: "dbo",
                table: "CityAreas");

            migrationBuilder.DropColumn(
                name: "IsManual",
                schema: "dbo",
                table: "CityAreaTrail");

            migrationBuilder.DropColumn(
                name: "Boundary",
                schema: "dbo",
                table: "CityAreas");

            migrationBuilder.DropColumn(
                name: "IsManual",
                schema: "dbo",
                table: "CityAreaFacility");
        }
    }
}
