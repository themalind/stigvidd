using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMailOutboxRetention : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "RedactedAt",
                schema: "dbo",
                table: "OutboxEmails",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SettledAt",
                schema: "dbo",
                table: "OutboxEmails",
                type: "timestamp with time zone",
                nullable: true);

            // Backfill, and it is not optional. MailOutboxRetentionService dates a settled row
            // by SettledAt and spares one where it is null -- deliberately, because a null in a
            // SQL comparison is neither true nor false and a row should not be deleted by
            // accident. Without this line every Failed and Cancelled row that already exists has
            // a null SettledAt, matches nothing, and is never swept: exactly the rows carrying an
            // address, a nickname and a token URL that this retention rule exists to clear.
            //
            // LastUpdatedAt is the best available approximation. Nothing touches a row once it
            // has settled, so for these rows it IS the moment they settled.
            //
            // 3 = Failed, 4 = Cancelled. Written as literals because OutboxEmailStatus is a C#
            // enum whose values are persisted, and a migration is the one place that must keep
            // meaning what it meant on the day it was applied.
            migrationBuilder.Sql(
                @"UPDATE dbo.""OutboxEmails""
                  SET ""SettledAt"" = ""LastUpdatedAt""
                  WHERE ""Status"" IN (3, 4) AND ""SettledAt"" IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RedactedAt",
                schema: "dbo",
                table: "OutboxEmails");

            migrationBuilder.DropColumn(
                name: "SettledAt",
                schema: "dbo",
                table: "OutboxEmails");
        }
    }
}
