using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemovedNoActionOnUserDeleteSolvedVote : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TrailObstacleSolvedVotes_Users_UserId",
                table: "TrailObstacleSolvedVotes");

            migrationBuilder.AddForeignKey(
                name: "FK_TrailObstacleSolvedVotes_Users_UserId",
                table: "TrailObstacleSolvedVotes",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TrailObstacleSolvedVotes_Users_UserId",
                table: "TrailObstacleSolvedVotes");

            migrationBuilder.AddForeignKey(
                name: "FK_TrailObstacleSolvedVotes_Users_UserId",
                table: "TrailObstacleSolvedVotes",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id");
        }
    }
}
