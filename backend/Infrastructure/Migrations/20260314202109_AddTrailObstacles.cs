using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTrailObstacles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "Rating",
                table: "Reviews",
                type: "decimal(3,1)",
                precision: 3,
                scale: 1,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,2)");

            migrationBuilder.CreateTable(
                name: "TrailObstacles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IssueType = table.Column<int>(type: "int", nullable: false),
                    IncidentLongitude = table.Column<decimal>(type: "decimal(18,10)", precision: 18, scale: 10, nullable: true),
                    IncidentLatitude = table.Column<decimal>(type: "decimal(18,10)", precision: 18, scale: 10, nullable: true),
                    TrailId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Identifier = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrailObstacles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrailObstacles_Trails_TrailId",
                        column: x => x.TrailId,
                        principalTable: "Trails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TrailObstacles_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TrailObstacleSolvedVotes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TrailObstacleId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Identifier = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrailObstacleSolvedVotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrailObstacleSolvedVotes_TrailObstacles_TrailObstacleId",
                        column: x => x.TrailObstacleId,
                        principalTable: "TrailObstacles",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_TrailObstacleSolvedVotes_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_TrailObstacles_TrailId",
                table: "TrailObstacles",
                column: "TrailId");

            migrationBuilder.CreateIndex(
                name: "IX_TrailObstacles_UserId",
                table: "TrailObstacles",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_TrailObstacleSolvedVotes_TrailObstacleId_UserId",
                table: "TrailObstacleSolvedVotes",
                columns: new[] { "TrailObstacleId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TrailObstacleSolvedVotes_UserId",
                table: "TrailObstacleSolvedVotes",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TrailObstacleSolvedVotes");

            migrationBuilder.DropTable(
                name: "TrailObstacles");

            migrationBuilder.AlterColumn<decimal>(
                name: "Rating",
                table: "Reviews",
                type: "decimal(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(3,1)",
                oldPrecision: 3,
                oldScale: 1);
        }
    }
}
