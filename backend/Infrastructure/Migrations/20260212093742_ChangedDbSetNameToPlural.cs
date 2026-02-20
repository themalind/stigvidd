using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ChangedDbSetNameToPlural : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_VisitorInformation_Trails_TrailId",
                table: "VisitorInformation");

            migrationBuilder.DropPrimaryKey(
                name: "PK_VisitorInformation",
                table: "VisitorInformation");

            migrationBuilder.RenameTable(
                name: "VisitorInformation",
                newName: "VisitorInformations");

            migrationBuilder.RenameIndex(
                name: "IX_VisitorInformation_TrailId",
                table: "VisitorInformations",
                newName: "IX_VisitorInformations_TrailId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_VisitorInformations",
                table: "VisitorInformations",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_VisitorInformations_Trails_TrailId",
                table: "VisitorInformations",
                column: "TrailId",
                principalTable: "Trails",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_VisitorInformations_Trails_TrailId",
                table: "VisitorInformations");

            migrationBuilder.DropPrimaryKey(
                name: "PK_VisitorInformations",
                table: "VisitorInformations");

            migrationBuilder.RenameTable(
                name: "VisitorInformations",
                newName: "VisitorInformation");

            migrationBuilder.RenameIndex(
                name: "IX_VisitorInformations_TrailId",
                table: "VisitorInformation",
                newName: "IX_VisitorInformation_TrailId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_VisitorInformation",
                table: "VisitorInformation",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_VisitorInformation_Trails_TrailId",
                table: "VisitorInformation",
                column: "TrailId",
                principalTable: "Trails",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
