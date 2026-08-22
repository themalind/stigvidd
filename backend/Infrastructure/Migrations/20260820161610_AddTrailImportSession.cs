using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTrailImportSession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TrailImportSessions",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Source = table.Column<string>(type: "text", nullable: false),
                    FileName = table.Column<string>(type: "text", nullable: false),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    FileHash = table.Column<string>(type: "text", nullable: false),
                    StoredPath = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    UploadedBy = table.Column<string>(type: "text", nullable: true),
                    AnalyzedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AppliedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FeatureCount = table.Column<int>(type: "integer", nullable: false),
                    ErrorMessage = table.Column<string>(type: "text", nullable: true),
                    ApplyReport = table.Column<string>(type: "jsonb", nullable: true),
                    Identifier = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrailImportSessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TrailImportProposals",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SessionId = table.Column<int>(type: "integer", nullable: false),
                    ExternalId = table.Column<string>(type: "text", nullable: false),
                    FeatureName = table.Column<string>(type: "text", nullable: false),
                    GeometryFingerprint = table.Column<string>(type: "text", nullable: false),
                    FeatureProperties = table.Column<string>(type: "jsonb", nullable: true),
                    FeatureGeometry = table.Column<LineString>(type: "geometry", nullable: true),
                    SuggestedTrailId = table.Column<int>(type: "integer", nullable: true),
                    DecidedTrailId = table.Column<int>(type: "integer", nullable: true),
                    CreatedTrailId = table.Column<int>(type: "integer", nullable: true),
                    Confidence = table.Column<int>(type: "integer", nullable: false),
                    CoverageForward = table.Column<double>(type: "double precision", nullable: false),
                    CoverageBackward = table.Column<double>(type: "double precision", nullable: false),
                    HausdorffMeters = table.Column<double>(type: "double precision", nullable: true),
                    MatchReason = table.Column<string>(type: "text", nullable: true),
                    Decision = table.Column<int>(type: "integer", nullable: false),
                    DecidedRole = table.Column<int>(type: "integer", nullable: false),
                    DecidedBy = table.Column<string>(type: "text", nullable: true),
                    DecidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Note = table.Column<string>(type: "text", nullable: true),
                    Identifier = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrailImportProposals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrailImportProposals_TrailImportSessions_SessionId",
                        column: x => x.SessionId,
                        principalSchema: "dbo",
                        principalTable: "TrailImportSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TrailImportProposals_SessionId",
                schema: "dbo",
                table: "TrailImportProposals",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_TrailImportSessions_Source_FileHash",
                schema: "dbo",
                table: "TrailImportSessions",
                columns: new[] { "Source", "FileHash" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TrailImportProposals",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "TrailImportSessions",
                schema: "dbo");
        }
    }
}
