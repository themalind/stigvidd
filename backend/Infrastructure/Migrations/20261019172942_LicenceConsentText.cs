using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class LicenceConsentText : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                schema: "dbo",
                table: "ConsentTexts",
                columns: new[] { "Id", "CreatedAt", "Kind", "Locale", "Text", "Version" },
                values: new object[,]
                {
                    { 3, new DateTime(2026, 10, 19, 0, 0, 0, 0, DateTimeKind.Utc), "hike-transfer", "sv", "Jag ger Stigvidd rätt att publicera den här promenaden som en led. Stigvidd får för alltid och utan ersättning använda, ändra och publicera text, linje och valda bilder. Rätten går inte att återkalla efter att leden publicerats. Du behåller upphovsrätten till dina bilder och kan fortfarande ta bort din egen promenad.", "2026-10-19" },
                    { 4, new DateTime(2026, 10, 19, 0, 0, 0, 0, DateTimeKind.Utc), "hike-transfer", "en", "I give Stigvidd the right to publish this walk as a trail. Stigvidd may use, edit and publish the text, route and chosen photos, forever and free of charge. This right cannot be withdrawn once the trail is published. You keep the copyright to your photos and can still delete your own walk.", "2026-10-19" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "dbo",
                table: "ConsentTexts",
                keyColumn: "Id",
                keyValue: 3);

            migrationBuilder.DeleteData(
                schema: "dbo",
                table: "ConsentTexts",
                keyColumn: "Id",
                keyValue: 4);
        }
    }
}
