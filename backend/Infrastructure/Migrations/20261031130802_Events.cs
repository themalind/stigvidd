using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Events : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Events",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    TrailId = table.Column<int>(type: "integer", nullable: true),
                    LocationName = table.Column<string>(type: "text", nullable: true),
                    MeetingPoint = table.Column<Point>(type: "geometry(Point, 4326)", nullable: true),
                    MeetingPointName = table.Column<string>(type: "text", nullable: true),
                    Location = table.Column<Point>(type: "geometry(Point, 4326)", nullable: false),
                    StartsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PastAfter = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RegistrationDeadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MaxParticipants = table.Column<int>(type: "integer", nullable: true),
                    ParticipantCount = table.Column<int>(type: "integer", nullable: false),
                    Visibility = table.Column<int>(type: "integer", nullable: false),
                    AllowParticipantInvites = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModerationState = table.Column<int>(type: "integer", nullable: false),
                    Identifier = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Events", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Events_Trails_TrailId",
                        column: x => x.TrailId,
                        principalSchema: "dbo",
                        principalTable: "Trails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "UserActionLogs",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Action = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserActionLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserActionLogs_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EventImages",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EventId = table.Column<int>(type: "integer", nullable: false),
                    ImageUrl = table.Column<string>(type: "text", nullable: false),
                    ModerationState = table.Column<int>(type: "integer", nullable: false),
                    Identifier = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventImages_Events_EventId",
                        column: x => x.EventId,
                        principalSchema: "dbo",
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EventInvitations",
                schema: "dbo",
                columns: table => new
                {
                    EventId = table.Column<int>(type: "integer", nullable: false),
                    InvitedUserId = table.Column<int>(type: "integer", nullable: false),
                    InvitedByUserId = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventInvitations", x => new { x.EventId, x.InvitedUserId });
                    table.ForeignKey(
                        name: "FK_EventInvitations_Events_EventId",
                        column: x => x.EventId,
                        principalSchema: "dbo",
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EventInvitations_Users_InvitedByUserId",
                        column: x => x.InvitedByUserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_EventInvitations_Users_InvitedUserId",
                        column: x => x.InvitedUserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EventParticipants",
                schema: "dbo",
                columns: table => new
                {
                    EventId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    JoinedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    MutePosts = table.Column<bool>(type: "boolean", nullable: false),
                    LastPostPushAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastReadPostAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventParticipants", x => new { x.EventId, x.UserId });
                    table.ForeignKey(
                        name: "FK_EventParticipants_Events_EventId",
                        column: x => x.EventId,
                        principalSchema: "dbo",
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EventParticipants_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EventPosts",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EventId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: true),
                    Body = table.Column<string>(type: "text", nullable: false),
                    IsPinned = table.Column<bool>(type: "boolean", nullable: false),
                    EditedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModerationState = table.Column<int>(type: "integer", nullable: false),
                    Identifier = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventPosts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventPosts_Events_EventId",
                        column: x => x.EventId,
                        principalSchema: "dbo",
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EventPosts_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "EventRoutes",
                schema: "dbo",
                columns: table => new
                {
                    EventId = table.Column<int>(type: "integer", nullable: false),
                    Path = table.Column<LineString>(type: "geometry(LineString, 4326)", nullable: false),
                    LengthMetres = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventRoutes", x => x.EventId);
                    table.ForeignKey(
                        name: "FK_EventRoutes_Events_EventId",
                        column: x => x.EventId,
                        principalSchema: "dbo",
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EventImages_EventId",
                schema: "dbo",
                table: "EventImages",
                column: "EventId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EventImages_Identifier",
                schema: "dbo",
                table: "EventImages",
                column: "Identifier",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EventInvitations_InvitedByUserId_CreatedAt",
                schema: "dbo",
                table: "EventInvitations",
                columns: new[] { "InvitedByUserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_EventInvitations_InvitedUserId_Status",
                schema: "dbo",
                table: "EventInvitations",
                columns: new[] { "InvitedUserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_EventParticipants_OneOrganizer",
                schema: "dbo",
                table: "EventParticipants",
                column: "EventId",
                unique: true,
                filter: "\"Role\" = 0");

            migrationBuilder.CreateIndex(
                name: "IX_EventParticipants_UserId_Status",
                schema: "dbo",
                table: "EventParticipants",
                columns: new[] { "UserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_EventPosts_EventId_CreatedAt_Id",
                schema: "dbo",
                table: "EventPosts",
                columns: new[] { "EventId", "CreatedAt", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_EventPosts_Identifier",
                schema: "dbo",
                table: "EventPosts",
                column: "Identifier",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EventPosts_UserId",
                schema: "dbo",
                table: "EventPosts",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Events_Identifier",
                schema: "dbo",
                table: "Events",
                column: "Identifier",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Events_Location",
                schema: "dbo",
                table: "Events",
                column: "Location")
                .Annotation("Npgsql:IndexMethod", "gist");

            migrationBuilder.CreateIndex(
                name: "IX_Events_PastAfter",
                schema: "dbo",
                table: "Events",
                column: "PastAfter");

            migrationBuilder.CreateIndex(
                name: "IX_Events_TrailId",
                schema: "dbo",
                table: "Events",
                column: "TrailId");

            migrationBuilder.CreateIndex(
                name: "IX_Events_Visibility_Status_StartsAt_Id",
                schema: "dbo",
                table: "Events",
                columns: new[] { "Visibility", "Status", "StartsAt", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_UserActionLogs_UserId_Action_CreatedAt",
                schema: "dbo",
                table: "UserActionLogs",
                columns: new[] { "UserId", "Action", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EventImages",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "EventInvitations",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "EventParticipants",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "EventPosts",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "EventRoutes",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "UserActionLogs",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Events",
                schema: "dbo");
        }
    }
}
