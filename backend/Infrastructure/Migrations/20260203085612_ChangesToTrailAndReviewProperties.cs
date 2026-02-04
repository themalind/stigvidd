using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ChangesToTrailAndReviewProperties : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Grade",
                table: "Reviews",
                newName: "Rating");

            migrationBuilder.RenameColumn(
                name: "CoordinatesJson",
                table: "Trails",
                newName: "Coordinates");

            migrationBuilder.RenameColumn(
                name: "AccessabilityInfo",
                table: "Trails",
                newName: "AccessibilityInfo");

            migrationBuilder.RenameColumn(
                name: "Accessability",
                table: "Trails",
                newName: "Accessibility");
            
            migrationBuilder.AlterColumn<decimal>(
                name: "Rating",
                table: "Reviews",
                type: "decimal(3,2)",
                nullable: false,
                oldClrType: typeof(float),
                oldType: "float");

            migrationBuilder.AlterColumn<decimal>(
                name: "TrailLength",
                table: "Trails",
                type: "decimal(18,2)",
                nullable: false,
                oldClrType: typeof(double),
                oldType: "float");

            migrationBuilder.AlterColumn<int>(
                name: "Classification",
                table: "Trails",
                type: "int",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<string>(
                name: "FullDescription",
                table: "Trails",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "Trails",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "Trails",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "Trails");

            migrationBuilder.DropColumn(
                name: "City",
                table: "Trails");

            migrationBuilder.DropColumn(
                name: "FullDescription",
                table: "Trails");

            migrationBuilder.RenameColumn(
                name: "AccessibilityInfo",
                table: "Trails",
                newName: "AccessabilityInfo");

            migrationBuilder.RenameColumn(
                name: "Coordinates",
                table: "Trails",
                newName: "CoordinatesJson");

            migrationBuilder.RenameColumn(
                name: "Accessibility",
                table: "Trails",
                newName: "Accessability");

            migrationBuilder.AlterColumn<float>(
                name: "Rating",
                table: "Reviews",
                type: "float",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(3,2)");

            migrationBuilder.RenameColumn(
                name: "Rating",
                table: "Reviews",
                newName: "Grade");

            migrationBuilder.AlterColumn<double>(
                name: "TrailLength",
                table: "Trails",
                type: "float",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,2)");

            migrationBuilder.AlterColumn<string>(
                name: "Classification",
                table: "Trails",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int");
        }
    }
}
