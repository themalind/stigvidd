using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PostGIS : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:postgis", ",,");

            migrationBuilder.AddColumn<Geometry>(
                name: "Geometry",
                schema: "dbo",
                table: "Trails",
                type: "geometry",
                nullable: true);

            migrationBuilder.Sql("""
            ;with geo ("Id", "Geometry") as (
            select t."Id", ST_SetSRID(ST_MakeLine(ST_MakePoint(jt.longitude, jt.latitude)),4326) "Geometry" from dbo."Trails" t, 
            JSON_TABLE (t."Coordinates"::json, '$[*]' COLUMNS (
               longitude float PATH '$.longitude',
               latitude float PATH '$.latitude')) AS jt
            group by t."Id"
            )
            UPDATE dbo."Trails" t set "Geometry"=geo."Geometry"
            FROM geo WHERE t."Id"=geo."Id";
            """
            );                
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Geometry",
                schema: "dbo",
                table: "Trails");

            migrationBuilder.AlterDatabase()
                .OldAnnotation("Npgsql:PostgresExtension:postgis", ",,");
        }
    }
}
