using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddResharingAndCreatorNickName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AllowResharing",
                schema: "dbo",
                table: "HikeShares",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AlterColumn<string>(
                name: "CreatedBy",
                schema: "dbo",
                table: "Hikes",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "CreatedByNickName",
                schema: "dbo",
                table: "Hikes",
                type: "text",
                nullable: true);

            // Backfill: the recipient view is about to read this copy instead of joining
            // Hike.User, so every hike created before this migration would otherwise render
            // as "removed user" even though its owner is very much alive. Matching on
            // CreatedBy rather than UserId is deliberate — a hike whose owner removed it
            // from their own list has UserId = null but a living user row, and the
            // recipient should keep seeing the name. Hikes whose owner has deleted their
            // account match nothing and stay null, which is the correct fallback.
            migrationBuilder.Sql("""
                UPDATE "dbo"."Hikes" h
                SET "CreatedByNickName" = u."NickName"
                FROM "dbo"."Users" u
                WHERE u."Identifier" = h."CreatedBy"
                  AND h."CreatedByNickName" IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AllowResharing",
                schema: "dbo",
                table: "HikeShares");

            migrationBuilder.DropColumn(
                name: "CreatedByNickName",
                schema: "dbo",
                table: "Hikes");

            migrationBuilder.AlterColumn<string>(
                name: "CreatedBy",
                schema: "dbo",
                table: "Hikes",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);
        }
    }
}
