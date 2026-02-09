using System;
using Microsoft.EntityFrameworkCore.Migrations;
#nullable disable
namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PropertiesAndClassToTrailAndTrailLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsVerified",
                table: "Trails",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.RenameColumn(
                name: "City",
                table: "Trails",
                newName: "Tags");

            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "Trails",
                type: "nvarchar(64)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "TrailLinks",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "VisitorInformation",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GettingThere = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PublicTransport = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Parking = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TrailId = table.Column<int>(type: "int", nullable: false),
                    Identifier = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VisitorInformation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VisitorInformation_Trails_TrailId",
                        column: x => x.TrailId,
                        principalTable: "Trails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VisitorInformation_TrailId",
                table: "VisitorInformation",
                column: "TrailId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VisitorInformation");

            migrationBuilder.DropColumn(
                name: "IsVerified",
                table: "Trails");

            migrationBuilder.RenameColumn(
                name: "Tags",
                table: "Trails",
                newName: "City");

            migrationBuilder.DropColumn(
                name: "City",
                table: "Trails");

            migrationBuilder.DropColumn(
                name: "Title",
                table: "TrailLinks");
        }
    }
}