using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ReconfigureManyToManyOnUserTrail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UserFavorites_Trails_MyFavoritesId",
                table: "UserFavorites");

            migrationBuilder.DropForeignKey(
                name: "FK_UserFavorites_Users_User1Id",
                table: "UserFavorites");

            migrationBuilder.DropTable(
                name: "UserWishLists");

            migrationBuilder.RenameColumn(
                name: "User1Id",
                table: "UserFavorites",
                newName: "TrailId");

            migrationBuilder.RenameColumn(
                name: "MyFavoritesId",
                table: "UserFavorites",
                newName: "UserId");

            migrationBuilder.RenameIndex(
                name: "IX_UserFavorites_User1Id",
                table: "UserFavorites",
                newName: "IX_UserFavorites_TrailId");

            migrationBuilder.CreateTable(
                name: "UserWishList",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    TrailId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserWishList", x => new { x.UserId, x.TrailId });
                    table.ForeignKey(
                        name: "FK_UserWishList_Trails_TrailId",
                        column: x => x.TrailId,
                        principalTable: "Trails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserWishList_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserWishList_TrailId",
                table: "UserWishList",
                column: "TrailId");

            migrationBuilder.AddForeignKey(
                name: "FK_UserFavorites_Trails_TrailId",
                table: "UserFavorites",
                column: "TrailId",
                principalTable: "Trails",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserFavorites_Users_UserId",
                table: "UserFavorites",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UserFavorites_Trails_TrailId",
                table: "UserFavorites");

            migrationBuilder.DropForeignKey(
                name: "FK_UserFavorites_Users_UserId",
                table: "UserFavorites");

            migrationBuilder.DropTable(
                name: "UserWishList");

            migrationBuilder.RenameColumn(
                name: "TrailId",
                table: "UserFavorites",
                newName: "User1Id");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "UserFavorites",
                newName: "MyFavoritesId");

            migrationBuilder.RenameIndex(
                name: "IX_UserFavorites_TrailId",
                table: "UserFavorites",
                newName: "IX_UserFavorites_User1Id");

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
                name: "IX_UserWishLists_UserId",
                table: "UserWishLists",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_UserFavorites_Trails_MyFavoritesId",
                table: "UserFavorites",
                column: "MyFavoritesId",
                principalTable: "Trails",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserFavorites_Users_User1Id",
                table: "UserFavorites",
                column: "User1Id",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
