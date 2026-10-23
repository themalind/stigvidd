using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ClearRejectedHikeSubmissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<LineString>(
                name: "OriginalGeoPath",
                schema: "dbo",
                table: "HikeSubmissions",
                type: "geometry(LineString, 4326)",
                nullable: true,
                oldClrType: typeof(LineString),
                oldType: "geometry(LineString, 4326)",
                oldNullable: false);

            migrationBuilder.AlterColumn<LineString>(
                name: "GeoPath",
                schema: "dbo",
                table: "HikeSubmissions",
                type: "geometry(LineString, 4326)",
                nullable: true,
                oldClrType: typeof(LineString),
                oldType: "geometry(LineString, 4326)",
                oldNullable: false);

            // keep-comment: Status 2 is HikeSubmissionStatus.Rejected; clears what RejectAsync clears for rows rejected before it did
            migrationBuilder.Sql("""
            UPDATE dbo."HikeSubmissions"
            SET "GeoPath" = NULL, "OriginalGeoPath" = NULL, "Description" = '', "Parking" = '',
                "GettingThere" = '', "PublicTransport" = '', "LongestGapMetres" = 0
            WHERE "Status" = 2;
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // keep-comment: a cleared rejection has no route to restore, so it cannot satisfy NOT NULL
            migrationBuilder.Sql("""
            DELETE FROM dbo."HikeSubmissions" WHERE "GeoPath" IS NULL OR "OriginalGeoPath" IS NULL;
            """);

            migrationBuilder.AlterColumn<LineString>(
                name: "OriginalGeoPath",
                schema: "dbo",
                table: "HikeSubmissions",
                type: "geometry(LineString, 4326)",
                nullable: false,
                oldClrType: typeof(LineString),
                oldType: "geometry(LineString, 4326)",
                oldNullable: true);

            migrationBuilder.AlterColumn<LineString>(
                name: "GeoPath",
                schema: "dbo",
                table: "HikeSubmissions",
                type: "geometry(LineString, 4326)",
                nullable: false,
                oldClrType: typeof(LineString),
                oldType: "geometry(LineString, 4326)",
                oldNullable: true);
        }
    }
}
