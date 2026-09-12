using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddContentReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ModerationState",
                schema: "dbo",
                table: "TrailObstacles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ModerationState",
                schema: "dbo",
                table: "Reviews",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "ContentReports",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ContentType = table.Column<int>(type: "integer", nullable: false),
                    ContentId = table.Column<int>(type: "integer", nullable: false),
                    ContentIdentifier = table.Column<string>(type: "text", nullable: false),
                    TrailId = table.Column<int>(type: "integer", nullable: true),
                    TrailIdentifier = table.Column<string>(type: "text", nullable: true),
                    ContentSnapshot = table.Column<string>(type: "text", nullable: true),
                    AuthorNickNameSnapshot = table.Column<string>(type: "text", nullable: true),
                    ContentAuthorUserId = table.Column<int>(type: "integer", nullable: true),
                    ReporterUserId = table.Column<int>(type: "integer", nullable: true),
                    Reason = table.Column<int>(type: "integer", nullable: false),
                    ReporterNote = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    HideOutcome = table.Column<int>(type: "integer", nullable: false),
                    DecidedBy = table.Column<string>(type: "text", nullable: true),
                    DecidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DecisionNote = table.Column<string>(type: "text", nullable: true),
                    Identifier = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContentReports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ContentReports_Users_ReporterUserId",
                        column: x => x.ReporterUserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ContentReports_ContentAuthorUserId_Status",
                schema: "dbo",
                table: "ContentReports",
                columns: new[] { "ContentAuthorUserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ContentReports_ContentType_ContentId",
                schema: "dbo",
                table: "ContentReports",
                columns: new[] { "ContentType", "ContentId" });

            migrationBuilder.CreateIndex(
                name: "IX_ContentReports_ReporterUserId_ContentType_ContentId",
                schema: "dbo",
                table: "ContentReports",
                columns: new[] { "ReporterUserId", "ContentType", "ContentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ContentReports_ReporterUserId_Status",
                schema: "dbo",
                table: "ContentReports",
                columns: new[] { "ReporterUserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ContentReports_Status_CreatedAt",
                schema: "dbo",
                table: "ContentReports",
                columns: new[] { "Status", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ContentReports",
                schema: "dbo");

            migrationBuilder.DropColumn(
                name: "ModerationState",
                schema: "dbo",
                table: "TrailObstacles");

            migrationBuilder.DropColumn(
                name: "ModerationState",
                schema: "dbo",
                table: "Reviews");
        }
    }
}
