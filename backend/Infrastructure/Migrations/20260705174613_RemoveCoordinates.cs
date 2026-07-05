using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveCoordinates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Coordinates",
                schema: "dbo",
                table: "Trails");

            migrationBuilder.DropColumn(
                name: "Geometry",
                schema: "dbo",
                table: "Trails");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Coordinates",
                schema: "dbo",
                table: "Trails",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Geometry>(
                name: "Geometry",
                schema: "dbo",
                table: "Trails",
                type: "geometry",
                nullable: true);
        }
    }
}
