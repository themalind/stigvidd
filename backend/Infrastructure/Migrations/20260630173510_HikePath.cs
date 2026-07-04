using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class HikePath : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.AddColumn<LineString>(
                name: "GeoPath",
                schema: "dbo",
                table: "Hikes",
                type: "geometry",
                nullable: false);

            migrationBuilder.Sql("""
            ;with geo ("Id", "Geometry") as (
            select t."Id", ST_SetSRID(ST_MakeLine(ST_MakePoint(jt.longitude, jt.latitude)),4326) "Geometry" from dbo."Hikes" t, 
            JSON_TABLE (t."Coordinates"::json, '$[*]' COLUMNS (
               longitude float PATH '$.longitude',
               latitude float PATH '$.latitude')) AS jt
            group by t."Id"
            )
            UPDATE dbo."Hikes" t set "GeoPath"=geo."Geometry"
            FROM geo WHERE t."Id"=geo."Id";
            """
            );                      

            migrationBuilder.DropColumn(
                name: "Coordinates",
                schema: "dbo",
                table: "Hikes");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GeoPath",
                schema: "dbo",
                table: "Hikes");

            migrationBuilder.AddColumn<string>(
                name: "Coordinates",
                schema: "dbo",
                table: "Hikes",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
