using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMediaLibrary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AltText",
                schema: "dbo",
                table: "TrailImages",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Caption",
                schema: "dbo",
                table: "TrailImages",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Height",
                schema: "dbo",
                table: "TrailImages",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<long>(
                name: "SizeBytes",
                schema: "dbo",
                table: "TrailImages",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                schema: "dbo",
                table: "TrailImages",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Width",
                schema: "dbo",
                table: "TrailImages",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "FacilityImages",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ImageUrl = table.Column<string>(type: "text", nullable: false),
                    FacilityId = table.Column<int>(type: "integer", nullable: false),
                    AltText = table.Column<string>(type: "text", nullable: true),
                    Caption = table.Column<string>(type: "text", nullable: true),
                    Width = table.Column<int>(type: "integer", nullable: false),
                    Height = table.Column<int>(type: "integer", nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Identifier = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilityImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FacilityImages_Facilities_FacilityId",
                        column: x => x.FacilityId,
                        principalSchema: "dbo",
                        principalTable: "Facilities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FacilityImages_FacilityId",
                schema: "dbo",
                table: "FacilityImages",
                column: "FacilityId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FacilityImages",
                schema: "dbo");

            migrationBuilder.DropColumn(
                name: "AltText",
                schema: "dbo",
                table: "TrailImages");

            migrationBuilder.DropColumn(
                name: "Caption",
                schema: "dbo",
                table: "TrailImages");

            migrationBuilder.DropColumn(
                name: "Height",
                schema: "dbo",
                table: "TrailImages");

            migrationBuilder.DropColumn(
                name: "SizeBytes",
                schema: "dbo",
                table: "TrailImages");

            migrationBuilder.DropColumn(
                name: "SortOrder",
                schema: "dbo",
                table: "TrailImages");

            migrationBuilder.DropColumn(
                name: "Width",
                schema: "dbo",
                table: "TrailImages");
        }
    }
}
