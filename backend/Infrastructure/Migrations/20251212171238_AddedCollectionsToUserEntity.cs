using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddedCollectionsToUserEntity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "UserId",
                table: "Trails",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UserId1",
                table: "Trails",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Trails_UserId",
                table: "Trails",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Trails_UserId1",
                table: "Trails",
                column: "UserId1");

            migrationBuilder.AddForeignKey(
                name: "FK_Trails_Users_UserId",
                table: "Trails",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Trails_Users_UserId1",
                table: "Trails",
                column: "UserId1",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Trails_Users_UserId",
                table: "Trails");

            migrationBuilder.DropForeignKey(
                name: "FK_Trails_Users_UserId1",
                table: "Trails");

            migrationBuilder.DropIndex(
                name: "IX_Trails_UserId",
                table: "Trails");

            migrationBuilder.DropIndex(
                name: "IX_Trails_UserId1",
                table: "Trails");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Trails");

            migrationBuilder.DropColumn(
                name: "UserId1",
                table: "Trails");
        }
    }
}
