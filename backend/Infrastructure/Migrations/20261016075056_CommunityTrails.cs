using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CommunityTrails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ConsentTexts",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Version = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Locale = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Text = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConsentTexts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HikeSubmissions",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    SourceHikeId = table.Column<int>(type: "integer", nullable: true),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    GeoPath = table.Column<LineString>(type: "geometry(LineString, 4326)", nullable: false),
                    OriginalGeoPath = table.Column<LineString>(type: "geometry(LineString, 4326)", nullable: false),
                    TrailLength = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    LongestGapMetres = table.Column<double>(type: "double precision", nullable: false),
                    Classification = table.Column<int>(type: "integer", nullable: false),
                    Parking = table.Column<string>(type: "text", nullable: false),
                    GettingThere = table.Column<string>(type: "text", nullable: false),
                    PublicTransport = table.Column<string>(type: "text", nullable: false),
                    ShowSubmitterName = table.Column<bool>(type: "boolean", nullable: false),
                    TransferAcceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ConsentTextId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RejectionReason = table.Column<string>(type: "text", nullable: true),
                    DecidedBy = table.Column<string>(type: "text", nullable: true),
                    DecidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PublishedTrailId = table.Column<int>(type: "integer", nullable: true),
                    Identifier = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HikeSubmissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HikeSubmissions_ConsentTexts_ConsentTextId",
                        column: x => x.ConsentTextId,
                        principalSchema: "dbo",
                        principalTable: "ConsentTexts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_HikeSubmissions_Hikes_SourceHikeId",
                        column: x => x.SourceHikeId,
                        principalSchema: "dbo",
                        principalTable: "Hikes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_HikeSubmissions_Trails_PublishedTrailId",
                        column: x => x.PublishedTrailId,
                        principalSchema: "dbo",
                        principalTable: "Trails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_HikeSubmissions_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TrailContributions",
                schema: "dbo",
                columns: table => new
                {
                    TrailId = table.Column<int>(type: "integer", nullable: false),
                    SubmittedByUserId = table.Column<int>(type: "integer", nullable: true),
                    ShowSubmitterName = table.Column<bool>(type: "boolean", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TransferAcceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ConsentTextId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrailContributions", x => x.TrailId);
                    table.ForeignKey(
                        name: "FK_TrailContributions_ConsentTexts_ConsentTextId",
                        column: x => x.ConsentTextId,
                        principalSchema: "dbo",
                        principalTable: "ConsentTexts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TrailContributions_Trails_TrailId",
                        column: x => x.TrailId,
                        principalSchema: "dbo",
                        principalTable: "Trails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TrailContributions_Users_SubmittedByUserId",
                        column: x => x.SubmittedByUserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "HikeSubmissionImages",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    HikeSubmissionId = table.Column<int>(type: "integer", nullable: false),
                    SourceHikeImageId = table.Column<int>(type: "integer", nullable: true),
                    ImageUrl = table.Column<string>(type: "text", nullable: false),
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
                    table.PrimaryKey("PK_HikeSubmissionImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HikeSubmissionImages_HikeImages_SourceHikeImageId",
                        column: x => x.SourceHikeImageId,
                        principalSchema: "dbo",
                        principalTable: "HikeImages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_HikeSubmissionImages_HikeSubmissions_HikeSubmissionId",
                        column: x => x.HikeSubmissionId,
                        principalSchema: "dbo",
                        principalTable: "HikeSubmissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TrailContributionLikes",
                schema: "dbo",
                columns: table => new
                {
                    TrailId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrailContributionLikes", x => new { x.TrailId, x.UserId });
                    table.ForeignKey(
                        name: "FK_TrailContributionLikes_TrailContributions_TrailId",
                        column: x => x.TrailId,
                        principalSchema: "dbo",
                        principalTable: "TrailContributions",
                        principalColumn: "TrailId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TrailContributionLikes_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                schema: "dbo",
                table: "ConsentTexts",
                columns: new[] { "Id", "CreatedAt", "Kind", "Locale", "Text", "Version" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 10, 15, 0, 0, 0, 0, DateTimeKind.Utc), "hike-transfer", "sv", "Jag godkänner att jag lämnar ifrån mig den här promenaden till Stigvidd. Text, linje och valda bilder blir Stigvidds. Det går inte att ångra efter att leden publicerats. Din egen promenad kan du fortfarande ta bort.", "2026-10-15" },
                    { 2, new DateTime(2026, 10, 15, 0, 0, 0, 0, DateTimeKind.Utc), "hike-transfer", "en", "I agree to hand this walk over to Stigvidd. The text, route and chosen photos become Stigvidd's. This cannot be undone once the trail is published. You can still delete your own walk.", "2026-10-15" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_ConsentTexts_Kind_Version_Locale",
                schema: "dbo",
                table: "ConsentTexts",
                columns: new[] { "Kind", "Version", "Locale" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HikeSubmissionImages_HikeSubmissionId",
                schema: "dbo",
                table: "HikeSubmissionImages",
                column: "HikeSubmissionId");

            migrationBuilder.CreateIndex(
                name: "IX_HikeSubmissionImages_SourceHikeImageId",
                schema: "dbo",
                table: "HikeSubmissionImages",
                column: "SourceHikeImageId");

            migrationBuilder.CreateIndex(
                name: "IX_HikeSubmissions_ConsentTextId",
                schema: "dbo",
                table: "HikeSubmissions",
                column: "ConsentTextId");

            migrationBuilder.CreateIndex(
                name: "IX_HikeSubmissions_Identifier",
                schema: "dbo",
                table: "HikeSubmissions",
                column: "Identifier",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HikeSubmissions_PublishedTrailId",
                schema: "dbo",
                table: "HikeSubmissions",
                column: "PublishedTrailId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HikeSubmissions_SourceHikeId",
                schema: "dbo",
                table: "HikeSubmissions",
                column: "SourceHikeId",
                unique: true,
                filter: "\"Status\" = 0");

            migrationBuilder.CreateIndex(
                name: "IX_HikeSubmissions_UserId",
                schema: "dbo",
                table: "HikeSubmissions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_TrailContributionLikes_UserId",
                schema: "dbo",
                table: "TrailContributionLikes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_TrailContributions_ConsentTextId",
                schema: "dbo",
                table: "TrailContributions",
                column: "ConsentTextId");

            migrationBuilder.CreateIndex(
                name: "IX_TrailContributions_SubmittedByUserId",
                schema: "dbo",
                table: "TrailContributions",
                column: "SubmittedByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HikeSubmissionImages",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "TrailContributionLikes",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "HikeSubmissions",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "TrailContributions",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "ConsentTexts",
                schema: "dbo");
        }
    }
}
