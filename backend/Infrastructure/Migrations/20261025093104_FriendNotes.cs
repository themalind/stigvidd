using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FriendNotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FriendNotes",
                schema: "dbo",
                columns: table => new
                {
                    OwnerUserId = table.Column<int>(type: "integer", nullable: false),
                    FriendUserId = table.Column<int>(type: "integer", nullable: false),
                    Text = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FriendNotes", x => new { x.OwnerUserId, x.FriendUserId });
                    table.ForeignKey(
                        name: "FK_FriendNotes_Users_FriendUserId",
                        column: x => x.FriendUserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_FriendNotes_Users_OwnerUserId",
                        column: x => x.OwnerUserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_FriendNotes_FriendUserId",
                schema: "dbo",
                table: "FriendNotes",
                column: "FriendUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FriendNotes",
                schema: "dbo");
        }
    }
}
