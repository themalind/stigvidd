using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ClientRequestIds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TrailObstacles_UserId",
                schema: "dbo",
                table: "TrailObstacles");

            migrationBuilder.DropIndex(
                name: "IX_Hikes_UserId",
                schema: "dbo",
                table: "Hikes");

            migrationBuilder.DropIndex(
                name: "IX_EventPosts_UserId",
                schema: "dbo",
                table: "EventPosts");

            migrationBuilder.AddColumn<Guid>(
                name: "ClientRequestId",
                schema: "dbo",
                table: "TrailObstacles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ClientRequestId",
                schema: "dbo",
                table: "Hikes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ClientRequestId",
                schema: "dbo",
                table: "Events",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ClientRequestId",
                schema: "dbo",
                table: "EventPosts",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TrailObstacles_UserId_ClientRequestId",
                schema: "dbo",
                table: "TrailObstacles",
                columns: new[] { "UserId", "ClientRequestId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Hikes_UserId_ClientRequestId",
                schema: "dbo",
                table: "Hikes",
                columns: new[] { "UserId", "ClientRequestId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Events_ClientRequestId",
                schema: "dbo",
                table: "Events",
                column: "ClientRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EventPosts_UserId_ClientRequestId",
                schema: "dbo",
                table: "EventPosts",
                columns: new[] { "UserId", "ClientRequestId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TrailObstacles_UserId_ClientRequestId",
                schema: "dbo",
                table: "TrailObstacles");

            migrationBuilder.DropIndex(
                name: "IX_Hikes_UserId_ClientRequestId",
                schema: "dbo",
                table: "Hikes");

            migrationBuilder.DropIndex(
                name: "IX_Events_ClientRequestId",
                schema: "dbo",
                table: "Events");

            migrationBuilder.DropIndex(
                name: "IX_EventPosts_UserId_ClientRequestId",
                schema: "dbo",
                table: "EventPosts");

            migrationBuilder.DropColumn(
                name: "ClientRequestId",
                schema: "dbo",
                table: "TrailObstacles");

            migrationBuilder.DropColumn(
                name: "ClientRequestId",
                schema: "dbo",
                table: "Hikes");

            migrationBuilder.DropColumn(
                name: "ClientRequestId",
                schema: "dbo",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "ClientRequestId",
                schema: "dbo",
                table: "EventPosts");

            migrationBuilder.CreateIndex(
                name: "IX_TrailObstacles_UserId",
                schema: "dbo",
                table: "TrailObstacles",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Hikes_UserId",
                schema: "dbo",
                table: "Hikes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_EventPosts_UserId",
                schema: "dbo",
                table: "EventPosts",
                column: "UserId");
        }
    }
}
