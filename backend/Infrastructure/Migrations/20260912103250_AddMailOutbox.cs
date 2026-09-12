using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMailOutbox : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MailTemplates",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Key = table.Column<string>(type: "text", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: false),
                    Subject = table.Column<string>(type: "text", nullable: false),
                    BodyHtml = table.Column<string>(type: "text", nullable: false),
                    BodyText = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Identifier = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MailTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OutboxEmails",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ToAddress = table.Column<string>(type: "text", nullable: false),
                    ToName = table.Column<string>(type: "text", nullable: true),
                    Subject = table.Column<string>(type: "text", nullable: false),
                    BodyHtml = table.Column<string>(type: "text", nullable: false),
                    BodyText = table.Column<string>(type: "text", nullable: false),
                    TemplateKey = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    NextAttemptAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "text", nullable: true),
                    Identifier = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OutboxEmails", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MailTemplates_Key_Language",
                schema: "dbo",
                table: "MailTemplates",
                columns: new[] { "Key", "Language" },
                unique: true);

            // One worked example, so the pipeline has something to exercise and whoever adds
            // the second template has a shape to copy.
            //
            // Hand-written InsertData rather than modelBuilder.HasData ON PURPOSE. HasData
            // makes these rows part of the EF model, so a later migration would revert an
            // operator's edit to the wording — which is the whole reason the copy lives in the
            // database instead of in the assembly. This is a plain one-time insert that EF
            // never looks at again.
            //
            // Id is deliberately omitted so the identity sequence stays ahead of the data; a
            // hard-coded 1 here is what reseed-identity-sequences.sql exists to clean up.
            migrationBuilder.InsertData(
                schema: "dbo",
                table: "MailTemplates",
                columns: new[] { "Key", "Language", "Subject", "BodyHtml", "BodyText", "Description", "Identifier", "CreatedAt", "LastUpdatedAt" },
                values: new object[]
                {
                    "welcome",
                    "sv",
                    "Välkommen till Stigvidd, {{NickName}}!",
                    "<p>Hej {{NickName}},</p>\n<p>Välkommen till Stigvidd. Nu kan du hitta leder, spara dina vandringar och dela dem med dina vänner.</p>\n<p>Trevlig vandring!</p>",
                    "Hej {{NickName}},\n\nVälkommen till Stigvidd. Nu kan du hitta leder, spara dina vandringar och dela dem med dina vänner.\n\nTrevlig vandring!",
                    "Skickas när en ny användare har registrerat sig. Platshållare: {{NickName}}.",
                    "8f6a1d24-3c7e-4f2b-9a0d-5e1c7b8d4a63",
                    new DateTime(2026, 9, 12, 0, 0, 0, DateTimeKind.Utc),
                    new DateTime(2026, 9, 12, 0, 0, 0, DateTimeKind.Utc),
                });

            migrationBuilder.CreateIndex(
                name: "IX_OutboxEmails_Status_NextAttemptAt",
                schema: "dbo",
                table: "OutboxEmails",
                columns: new[] { "Status", "NextAttemptAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MailTemplates",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "OutboxEmails",
                schema: "dbo");
        }
    }
}
