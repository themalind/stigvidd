using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailVerification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "EmailVerifiedAt",
                schema: "dbo",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "EmailVerificationTokens",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    TokenHash = table.Column<string>(type: "text", nullable: false),
                    CodeHash = table.Column<string>(type: "text", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ConsumedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    Identifier = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailVerificationTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmailVerificationTokens_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmailVerificationTokens_TokenHash",
                schema: "dbo",
                table: "EmailVerificationTokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmailVerificationTokens_UserId",
                schema: "dbo",
                table: "EmailVerificationTokens",
                column: "UserId");

            // Every existing user predates verification and is already enabled in Keycloak, so
            // they are verified by definition. Without this backfill they would all read as
            // unverified -- which the login gate would not act on, but every operator looking
            // at the column would be misled by.
            migrationBuilder.Sql(
                """
                UPDATE dbo."Users" SET "EmailVerifiedAt" = "CreatedAt" WHERE "EmailVerifiedAt" IS NULL;
                """);

            // Hand-written InsertData rather than modelBuilder.HasData ON PURPOSE -- see the
            // same note in 20260912103250_AddMailOutbox, and
            // docs/notes/mail-templates-seeded-with-insertdata.md. Id is omitted so the
            // identity sequence stays ahead of the data.
            migrationBuilder.InsertData(
                schema: "dbo",
                table: "MailTemplates",
                columns: new[] { "Key", "Language", "Subject", "BodyHtml", "BodyText", "Description", "Identifier", "CreatedAt", "LastUpdatedAt" },
                values: new object[]
                {
                    "verify-email",
                    "sv",
                    "Bekräfta din e-postadress hos Stigvidd",
                    "<p>Hej {{NickName}},</p>\n<p>Tack för att du skapade ett konto hos Stigvidd. Klicka på knappen för att bekräfta din e-postadress, så kan du logga in.</p>\n<p><a href=\"{{VerificationUrl}}\" style=\"display:inline-block;padding:12px 20px;border-radius:8px;background:#3f6b43;color:#ffffff;text-decoration:none\">Bekräfta e-postadressen</a></p>\n<p>Fungerar inte knappen? Kopiera den här länken till din webbläsare:<br>\n<a href=\"{{VerificationUrl}}\">{{VerificationUrl}}</a></p>\n<p>Du kan också skriva in den här koden i appen:</p>\n<p style=\"font-size:28px;letter-spacing:6px;font-weight:700\">{{VerificationCode}}</p>\n<p>Länken och koden gäller i 24 timmar. Om det inte var du som skapade kontot kan du strunta i det här mejlet.</p>",
                    "Hej {{NickName}},\n\nTack för att du skapade ett konto hos Stigvidd. Bekräfta din e-postadress för att kunna logga in:\n\n{{VerificationUrl}}\n\nDu kan också skriva in den här koden i appen: {{VerificationCode}}\n\nLänken och koden gäller i 24 timmar. Om det inte var du som skapade kontot kan du strunta i det här mejlet.",
                    "Skickas när en ny användare har registrerat sig och måste bekräfta sin e-postadress. Platshållare: {{NickName}}, {{VerificationUrl}}, {{VerificationCode}}.",
                    "c4b9e7a1-6d52-4f83-9b0e-2a7c8d1f5e46",
                    new DateTime(2026, 9, 12, 0, 0, 0, DateTimeKind.Utc),
                    new DateTime(2026, 9, 12, 0, 0, 0, DateTimeKind.Utc),
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "dbo",
                table: "MailTemplates",
                keyColumns: new[] { "Key", "Language" },
                keyValues: new object[] { "verify-email", "sv" });

            migrationBuilder.DropTable(
                name: "EmailVerificationTokens",
                schema: "dbo");

            migrationBuilder.DropColumn(
                name: "EmailVerifiedAt",
                schema: "dbo",
                table: "Users");
        }
    }
}
