using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPasswordReset : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PasswordResetTokens",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    TokenHash = table.Column<string>(type: "text", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ConsumedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Identifier = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordResetTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PasswordResetTokens_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetTokens_TokenHash",
                schema: "dbo",
                table: "PasswordResetTokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetTokens_UserId",
                schema: "dbo",
                table: "PasswordResetTokens",
                column: "UserId");

            // Hand-written InsertData rather than modelBuilder.HasData ON PURPOSE -- see
            // 20260912103250_AddMailOutbox, 20260912125829_AddEmailVerification and
            // docs/notes/mail-templates-seeded-with-insertdata.md. Id is omitted so the
            // identity sequence stays ahead of the data.
            migrationBuilder.InsertData(
                schema: "dbo",
                table: "MailTemplates",
                columns: new[] { "Key", "Language", "Subject", "BodyHtml", "BodyText", "Description", "Identifier", "CreatedAt", "LastUpdatedAt" },
                values: new object[]
                {
                    "reset-password",
                    "sv",
                    "Återställ ditt lösenord hos Stigvidd",
                    "<p>Hej {{NickName}},</p>\n<p>Du har begärt att återställa ditt lösenord hos Stigvidd. Klicka på knappen för att välja ett nytt.</p>\n<p><a href=\"{{ResetUrl}}\" style=\"display:inline-block;padding:12px 20px;border-radius:8px;background:#3f6b43;color:#ffffff;text-decoration:none\">Välj ett nytt lösenord</a></p>\n<p>Fungerar inte knappen? Kopiera den här länken till din webbläsare:<br>\n<a href=\"{{ResetUrl}}\">{{ResetUrl}}</a></p>\n<p>Länken gäller i två timmar och kan bara användas en gång. Om det inte var du som begärde en återställning kan du strunta i det här mejlet. Ditt lösenord ändras inte förrän någon har använt länken.</p>",
                    "Hej {{NickName}},\n\nDu har begärt att återställa ditt lösenord hos Stigvidd. Öppna den här länken för att välja ett nytt:\n\n{{ResetUrl}}\n\nLänken gäller i två timmar och kan bara användas en gång. Om det inte var du som begärde en återställning kan du strunta i det här mejlet. Ditt lösenord ändras inte förrän någon har använt länken.",
                    "Skickas när någon har begärt att återställa ett glömt lösenord. Platshållare: {{NickName}}, {{ResetUrl}}.",
                    "9e3d5f27-1a84-4c60-b7f2-6d08c4a91b3e",
                    new DateTime(2026, 9, 13, 0, 0, 0, DateTimeKind.Utc),
                    new DateTime(2026, 9, 13, 0, 0, 0, DateTimeKind.Utc),
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "dbo",
                table: "MailTemplates",
                keyColumns: new[] { "Key", "Language" },
                keyValues: new object[] { "reset-password", "sv" });

            migrationBuilder.DropTable(
                name: "PasswordResetTokens",
                schema: "dbo");
        }
    }
}
