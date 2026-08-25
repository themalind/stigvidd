using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTrailRelation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TrailRelations",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FromTrailId = table.Column<int>(type: "integer", nullable: false),
                    ToTrailId = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Sequence = table.Column<int>(type: "integer", nullable: true),
                    Identifier = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrailRelations", x => x.Id);
                    table.CheckConstraint("CK_TrailRelations_NotSelf", "\"FromTrailId\" <> \"ToTrailId\"");
                    table.ForeignKey(
                        name: "FK_TrailRelations_Trails_FromTrailId",
                        column: x => x.FromTrailId,
                        principalSchema: "dbo",
                        principalTable: "Trails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TrailRelations_Trails_ToTrailId",
                        column: x => x.ToTrailId,
                        principalSchema: "dbo",
                        principalTable: "Trails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TrailRelations_FromTrailId_ToTrailId_Type",
                schema: "dbo",
                table: "TrailRelations",
                columns: new[] { "FromTrailId", "ToTrailId", "Type" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TrailRelations_ToTrailId_Type",
                schema: "dbo",
                table: "TrailRelations",
                columns: new[] { "ToTrailId", "Type" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TrailRelations",
                schema: "dbo");
        }
    }
}
