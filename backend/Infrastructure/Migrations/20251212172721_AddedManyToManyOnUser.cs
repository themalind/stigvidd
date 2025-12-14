using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddedManyToManyOnUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
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

            migrationBuilder.CreateTable(
                name: "UserFavorites",
                columns: table => new
                {
                    MyFavoritesId = table.Column<int>(type: "int", nullable: false),
                    User1Id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserFavorites", x => new { x.MyFavoritesId, x.User1Id });
                    table.ForeignKey(
                        name: "FK_UserFavorites_Trails_MyFavoritesId",
                        column: x => x.MyFavoritesId,
                        principalTable: "Trails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserFavorites_Users_User1Id",
                        column: x => x.User1Id,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserWishLists",
                columns: table => new
                {
                    MyWishListId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserWishLists", x => new { x.MyWishListId, x.UserId });
                    table.ForeignKey(
                        name: "FK_UserWishLists_Trails_MyWishListId",
                        column: x => x.MyWishListId,
                        principalTable: "Trails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserWishLists_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserFavorites_User1Id",
                table: "UserFavorites",
                column: "User1Id");

            migrationBuilder.CreateIndex(
                name: "IX_UserWishLists_UserId",
                table: "UserWishLists",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserFavorites");

            migrationBuilder.DropTable(
                name: "UserWishLists");

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
    }
}
