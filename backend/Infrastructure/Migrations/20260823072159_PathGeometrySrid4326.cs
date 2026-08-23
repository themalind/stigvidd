using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PathGeometrySrid4326 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // No data statement here, deliberately, and do not add one.
            //
            // Measured against PostGIS 3.5: "ALTER COLUMN ... TYPE geometry(LineString, 4326)"
            // retags the existing rows itself. PostGIS treats SRID 0 as "unknown", so it is
            // assignable — the app-written paths silently become 4326 — while a genuinely
            // FOREIGN srid is refused outright:
            //     ERROR:  Geometry SRID (3006) does not match column SRID (4326)
            //
            // That error is a feature, and it is why there is no
            // "UPDATE ... SET GeoPath = ST_SetSRID(GeoPath, 4326) WHERE ST_SRID(...) <> 4326"
            // in front of these. Such a statement looks defensive and is the opposite: it
            // would relabel a SWEREF99 (3006) row as WGS84 without moving its coordinates,
            // putting a Boras trail in the Gulf of Guinea and reporting success. Letting the
            // ALTER refuse it keeps the one check that can catch a projected geometry.
            //
            // These paths were always WGS84 lon/lat VALUES anyway; the writers just never
            // stamped the SRID. So this is a relabel, not a reprojection: ST_Transform here
            // would move every trail in the country.
            migrationBuilder.AlterColumn<LineString>(
                name: "GeoPath",
                schema: "dbo",
                table: "Trails",
                type: "geometry(LineString, 4326)",
                nullable: true,
                oldClrType: typeof(LineString),
                oldType: "geometry",
                oldNullable: true);

            migrationBuilder.AlterColumn<LineString>(
                name: "FeatureGeometry",
                schema: "dbo",
                table: "TrailImportProposals",
                type: "geometry(LineString, 4326)",
                nullable: true,
                oldClrType: typeof(LineString),
                oldType: "geometry",
                oldNullable: true);

            migrationBuilder.AlterColumn<LineString>(
                name: "GeoPath",
                schema: "dbo",
                table: "Hikes",
                type: "geometry(LineString, 4326)",
                nullable: false,
                oldClrType: typeof(LineString),
                oldType: "geometry");
        }

        /// <inheritdoc />
        // Widening the typmod back to a bare "geometry" is always accepted. Note this is a
        // SCHEMA rollback, not a data one: rows the Up retagged stay 4326, because which of
        // them started out at 0 is recorded nowhere.
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<LineString>(
                name: "GeoPath",
                schema: "dbo",
                table: "Trails",
                type: "geometry",
                nullable: true,
                oldClrType: typeof(LineString),
                oldType: "geometry(LineString, 4326)",
                oldNullable: true);

            migrationBuilder.AlterColumn<LineString>(
                name: "FeatureGeometry",
                schema: "dbo",
                table: "TrailImportProposals",
                type: "geometry",
                nullable: true,
                oldClrType: typeof(LineString),
                oldType: "geometry(LineString, 4326)",
                oldNullable: true);

            migrationBuilder.AlterColumn<LineString>(
                name: "GeoPath",
                schema: "dbo",
                table: "Hikes",
                type: "geometry",
                nullable: false,
                oldClrType: typeof(LineString),
                oldType: "geometry(LineString, 4326)");
        }
    }
}
