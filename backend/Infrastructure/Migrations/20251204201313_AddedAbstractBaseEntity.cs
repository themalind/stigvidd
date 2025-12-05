using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddedAbstractBaseEntity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Users",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "LastUpdatedAt",
                table: "Users",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Trails",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "LastUpdatedAt",
                table: "Trails",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "TrailLinks",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "LastUpdatedAt",
                table: "TrailLinks",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "TrailImages",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "LastUpdatedAt",
                table: "TrailImages",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Statistics",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "LastUpdatedAt",
                table: "Statistics",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Reviews",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "LastUpdatedAt",
                table: "Reviews",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "ReviewImages",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "LastUpdatedAt",
                table: "ReviewImages",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.UpdateData(
                table: "ReviewImages",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "ReviewImages",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "ReviewImages",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 5,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 6,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 7,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 8,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 9,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 10,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 11,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 12,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 13,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 14,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 15,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 16,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 17,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 18,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 19,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 20,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 21,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 22,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 23,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 24,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 25,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 26,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 27,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 28,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 29,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 30,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 31,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Reviews",
                keyColumn: "Id",
                keyValue: 32,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 5,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 6,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 7,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 8,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 9,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 10,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 11,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 12,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 13,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 14,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 15,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 16,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 17,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 18,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 19,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 20,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 21,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 22,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 23,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 24,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 25,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 26,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 27,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 28,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 29,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "TrailImages",
                keyColumn: "Id",
                keyValue: 30,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Trails",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Trails",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Trails",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Trails",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Trails",
                keyColumn: "Id",
                keyValue: 5,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Trails",
                keyColumn: "Id",
                keyValue: 6,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Trails",
                keyColumn: "Id",
                keyValue: 7,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Trails",
                keyColumn: "Id",
                keyValue: 8,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 5,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: 6,
                columns: new[] { "CreatedAt", "LastUpdatedAt" },
                values: new object[] { new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 12, 4, 0, 0, 0, 0, DateTimeKind.Utc) });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastUpdatedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Trails");

            migrationBuilder.DropColumn(
                name: "LastUpdatedAt",
                table: "Trails");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "TrailLinks");

            migrationBuilder.DropColumn(
                name: "LastUpdatedAt",
                table: "TrailLinks");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "TrailImages");

            migrationBuilder.DropColumn(
                name: "LastUpdatedAt",
                table: "TrailImages");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Statistics");

            migrationBuilder.DropColumn(
                name: "LastUpdatedAt",
                table: "Statistics");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Reviews");

            migrationBuilder.DropColumn(
                name: "LastUpdatedAt",
                table: "Reviews");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "ReviewImages");

            migrationBuilder.DropColumn(
                name: "LastUpdatedAt",
                table: "ReviewImages");
        }
    }
}
