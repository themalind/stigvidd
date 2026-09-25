using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserBlocksAndBans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserBans",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    BannedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    BannedBy = table.Column<string>(type: "text", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: true),
                    LiftedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LiftedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserBans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserBans_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserBlocks",
                schema: "dbo",
                columns: table => new
                {
                    BlockerUserId = table.Column<int>(type: "integer", nullable: false),
                    BlockedUserId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserBlocks", x => new { x.BlockerUserId, x.BlockedUserId });
                    table.ForeignKey(
                        name: "FK_UserBlocks_Users_BlockedUserId",
                        column: x => x.BlockedUserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_UserBlocks_Users_BlockerUserId",
                        column: x => x.BlockerUserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserBans_UserId",
                schema: "dbo",
                table: "UserBans",
                column: "UserId",
                unique: true,
                filter: "\"LiftedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_UserBlocks_BlockedUserId",
                schema: "dbo",
                table: "UserBlocks",
                column: "BlockedUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserBans",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "UserBlocks",
                schema: "dbo");
        }
    }
}
