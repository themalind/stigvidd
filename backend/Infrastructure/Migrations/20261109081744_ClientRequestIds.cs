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
                name: "IX_TrailObstacles_ClientRequestId",
                schema: "dbo",
                table: "TrailObstacles",
                column: "ClientRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Hikes_ClientRequestId",
                schema: "dbo",
                table: "Hikes",
                column: "ClientRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Events_ClientRequestId",
                schema: "dbo",
                table: "Events",
                column: "ClientRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EventPosts_ClientRequestId",
                schema: "dbo",
                table: "EventPosts",
                column: "ClientRequestId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TrailObstacles_ClientRequestId",
                schema: "dbo",
                table: "TrailObstacles");

            migrationBuilder.DropIndex(
                name: "IX_Hikes_ClientRequestId",
                schema: "dbo",
                table: "Hikes");

            migrationBuilder.DropIndex(
                name: "IX_Events_ClientRequestId",
                schema: "dbo",
                table: "Events");

            migrationBuilder.DropIndex(
                name: "IX_EventPosts_ClientRequestId",
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
        }
    }
}
