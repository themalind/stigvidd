using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserKeycloakMappings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserKeycloakMappings",
                schema: "dbo",
                columns: table => new
                {
                    PackageUserId = table.Column<int>(type: "integer", nullable: false),
                    KeycloakSubjectId = table.Column<string>(type: "text", nullable: false),
                    KeycloakUsername = table.Column<string>(type: "text", nullable: false),
                    NickName = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserKeycloakMappings", x => x.PackageUserId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserKeycloakMappings_KeycloakSubjectId",
                schema: "dbo",
                table: "UserKeycloakMappings",
                column: "KeycloakSubjectId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserKeycloakMappings",
                schema: "dbo");
        }
    }
}
