using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSharedByToHikeShare : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM [HikeShares]");

            migrationBuilder.AddColumn<int>(
                name: "SharedById",
                table: "HikeShares",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_HikeShares_SharedById",
                table: "HikeShares",
                column: "SharedById");

            migrationBuilder.AddForeignKey(
                name: "FK_HikeShares_Users_SharedById",
                table: "HikeShares",
                column: "SharedById",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_HikeShares_Users_SharedById",
                table: "HikeShares");

            migrationBuilder.DropIndex(
                name: "IX_HikeShares_SharedById",
                table: "HikeShares");

            migrationBuilder.DropColumn(
                name: "SharedById",
                table: "HikeShares");
        }
    }
}
