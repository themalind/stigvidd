using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FacilityAndObstaclePoints : Migration
    {
        // Hand-edited from the scaffolded version, which dropped the decimal columns before
        // adding the geometry ones and would have lost every coordinate. Same add -> backfill
        // -> drop shape as the HikePath migration.
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Point>(
                name: "Coordinates",
                schema: "dbo",
                table: "Facilities",
                type: "geometry(Point, 4326)",
                nullable: true);

            migrationBuilder.AddColumn<Point>(
                name: "IncidentLocation",
                schema: "dbo",
                table: "TrailObstacles",
                type: "geometry(Point, 4326)",
                nullable: true);

            // Geometry is (X = longitude, Y = latitude). Rows missing either ordinate stay
            // null — a half pair was never a usable location.
            migrationBuilder.Sql("""
                UPDATE dbo."Facilities"
                SET "Coordinates" = ST_SetSRID(ST_MakePoint("Longitude", "Latitude"), 4326)
                WHERE "Longitude" IS NOT NULL AND "Latitude" IS NOT NULL;
                """);

            migrationBuilder.Sql("""
                UPDATE dbo."TrailObstacles"
                SET "IncidentLocation" = ST_SetSRID(ST_MakePoint("IncidentLongitude", "IncidentLatitude"), 4326)
                WHERE "IncidentLongitude" IS NOT NULL AND "IncidentLatitude" IS NOT NULL;
                """);

            migrationBuilder.DropColumn(
                name: "Latitude",
                schema: "dbo",
                table: "Facilities");

            migrationBuilder.DropColumn(
                name: "Longitude",
                schema: "dbo",
                table: "Facilities");

            migrationBuilder.DropColumn(
                name: "IncidentLatitude",
                schema: "dbo",
                table: "TrailObstacles");

            migrationBuilder.DropColumn(
                name: "IncidentLongitude",
                schema: "dbo",
                table: "TrailObstacles");

            // Proximity queries are the reason for the geometry columns; without these they
            // would be sequential scans.
            migrationBuilder.CreateIndex(
                name: "IX_Facilities_Coordinates",
                schema: "dbo",
                table: "Facilities",
                column: "Coordinates")
                .Annotation("Npgsql:IndexMethod", "gist");

            migrationBuilder.CreateIndex(
                name: "IX_TrailObstacles_IncidentLocation",
                schema: "dbo",
                table: "TrailObstacles",
                column: "IncidentLocation")
                .Annotation("Npgsql:IndexMethod", "gist");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Facilities_Coordinates",
                schema: "dbo",
                table: "Facilities");

            migrationBuilder.DropIndex(
                name: "IX_TrailObstacles_IncidentLocation",
                schema: "dbo",
                table: "TrailObstacles");

            migrationBuilder.AddColumn<decimal>(
                name: "Latitude",
                schema: "dbo",
                table: "Facilities",
                type: "numeric(18,5)",
                precision: 18,
                scale: 5,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Longitude",
                schema: "dbo",
                table: "Facilities",
                type: "numeric(18,5)",
                precision: 18,
                scale: 5,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "IncidentLatitude",
                schema: "dbo",
                table: "TrailObstacles",
                type: "numeric(18,10)",
                precision: 18,
                scale: 10,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "IncidentLongitude",
                schema: "dbo",
                table: "TrailObstacles",
                type: "numeric(18,10)",
                precision: 18,
                scale: 10,
                nullable: true);

            // The decimal columns are narrower than the geometry, so the round trip rounds:
            // facilities to 5 decimal places (~1 m), obstacles to 10.
            migrationBuilder.Sql("""
                UPDATE dbo."Facilities"
                SET "Latitude" = ST_Y("Coordinates")::numeric,
                    "Longitude" = ST_X("Coordinates")::numeric
                WHERE "Coordinates" IS NOT NULL;
                """);

            migrationBuilder.Sql("""
                UPDATE dbo."TrailObstacles"
                SET "IncidentLatitude" = ST_Y("IncidentLocation")::numeric,
                    "IncidentLongitude" = ST_X("IncidentLocation")::numeric
                WHERE "IncidentLocation" IS NOT NULL;
                """);

            migrationBuilder.DropColumn(
                name: "Coordinates",
                schema: "dbo",
                table: "Facilities");

            migrationBuilder.DropColumn(
                name: "IncidentLocation",
                schema: "dbo",
                table: "TrailObstacles");
        }
    }
}
