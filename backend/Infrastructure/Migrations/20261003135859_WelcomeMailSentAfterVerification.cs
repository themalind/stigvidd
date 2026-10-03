using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class WelcomeMailSentAfterVerification : Migration
    {
        /// <inheritdoc />
        // The welcome mail is now sent once the address is verified, not at registration, and
        // the web admin shows this column beside the copy. Description is matched in the
        // WHERE as well as the key, so the update only lands on the wording AddMailOutbox
        // seeded: an operator who has already rewritten it keeps theirs. A plain data change
        // that EF never looks at again -- see docs/notes/mail-templates-seeded-with-insertdata.md.
        private const string SeededDescription =
            "Skickas när en ny användare har registrerat sig. Platshållare: {{NickName}}.";

        private const string VerifiedDescription =
            "Skickas när en ny användare har bekräftat sin e-postadress och kan logga in. Platshållare: {{NickName}}.";

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "MailTemplates",
                keyColumns: new[] { "Key", "Language", "Description" },
                keyValues: new object[] { "welcome", "sv", SeededDescription },
                columns: new[] { "Description" },
                values: new object[] { VerifiedDescription });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "MailTemplates",
                keyColumns: new[] { "Key", "Language", "Description" },
                keyValues: new object[] { "welcome", "sv", VerifiedDescription },
                columns: new[] { "Description" },
                values: new object[] { SeededDescription });
        }
    }
}
