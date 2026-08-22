using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTrailSourceLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TrailSourceLinks",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Source = table.Column<string>(type: "text", nullable: false),
                    GeometryFingerprint = table.Column<string>(type: "text", nullable: false),
                    LastSeenExternalId = table.Column<string>(type: "text", nullable: true),
                    TrailId = table.Column<int>(type: "integer", nullable: true),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    Confidence = table.Column<int>(type: "integer", nullable: false),
                    ConfirmedByHuman = table.Column<bool>(type: "boolean", nullable: false),
                    SourceSnapshot = table.Column<string>(type: "jsonb", nullable: true),
                    LastSeenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    MissingSinceAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MissingImportCount = table.Column<int>(type: "integer", nullable: false),
                    Identifier = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrailSourceLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrailSourceLinks_Trails_TrailId",
                        column: x => x.TrailId,
                        principalSchema: "dbo",
                        principalTable: "Trails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TrailSourceLinks_Source_GeometryFingerprint",
                schema: "dbo",
                table: "TrailSourceLinks",
                columns: new[] { "Source", "GeometryFingerprint" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TrailSourceLinks_Source_LastSeenExternalId",
                schema: "dbo",
                table: "TrailSourceLinks",
                columns: new[] { "Source", "LastSeenExternalId" });

            migrationBuilder.CreateIndex(
                name: "IX_TrailSourceLinks_TrailId",
                schema: "dbo",
                table: "TrailSourceLinks",
                column: "TrailId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TrailSourceLinks",
                schema: "dbo");
        }
    }
}
