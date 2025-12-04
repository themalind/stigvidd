using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Firstmigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Trails",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Identifier = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TrailLenght = table.Column<double>(type: "float", nullable: false),
                    Classification = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Accessability = table.Column<bool>(type: "bit", nullable: false),
                    AccessabilityInfo = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TrailSymbol = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TrailSymbolImage = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CoordinatesJson = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Trails", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Identifier = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    NickName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TrailImages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Identifier = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ImageUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TrailId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrailImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrailImages_Trails_TrailId",
                        column: x => x.TrailId,
                        principalTable: "Trails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TrailLinks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Identifier = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Link = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TrailId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrailLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrailLinks_Trails_TrailId",
                        column: x => x.TrailId,
                        principalTable: "Trails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Reviews",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Identifier = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TrailReview = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Grade = table.Column<float>(type: "real", nullable: false),
                    TrailId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reviews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Reviews_Trails_TrailId",
                        column: x => x.TrailId,
                        principalTable: "Trails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Reviews_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Statistics",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Identifier = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TotalSteps = table.Column<int>(type: "int", nullable: false),
                    TotalKilometers = table.Column<double>(type: "float", nullable: false),
                    TotalWalkedTrails = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Statistics", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Statistics_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ReviewImages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Identifier = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ImageUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReviewId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReviewImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReviewImages_Reviews_ReviewId",
                        column: x => x.ReviewId,
                        principalTable: "Reviews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Trails",
                columns: new[] { "Id", "Accessability", "AccessabilityInfo", "Classification", "CoordinatesJson", "Description", "Identifier", "Name", "TrailLenght", "TrailSymbol", "TrailSymbolImage" },
                values: new object[,]
                {
                    { 1, false, "Delvis väldigt svår terräng, kräver god fysik", "Svår", null, "En dramatisk och utmanande vandring genom djupa skogar, höga klippor och stenformationer.", "0f8fad5b-d9cb-469f-a165-70867728950e", "Tiveden", 9.5, "Röd markering", "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png" },
                    { 2, false, "Delvis väldigt svår terräng, kräver god fysik", "Svår", null, "En varierad och bitvis krävande led som slingrar sig runt Storsjöns skogsområden.", "1a2b3c4d-5e6f-4789-0123-456789abcdef", "Storsjöleden", 8.5, "Blå markering", "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png" },
                    { 3, false, "Stigar, spångar och grusväg, vacker utsikt", "Medel", null, "En naturskön rundslinga genom Hofsnäsområdet med blandning av stigar, spångar och öppna utsikter.", "2b3c4d5e-6f70-4891-1234-56789abcdef0", "Tångaleden", 9.0999999999999996, "Orange markering", "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png" },
                    { 4, true, "Naturstigar, beteshagar, spång och grusväg", "Medel", null, "En inbjudande led som tar dig genom beteshagar, skogar och kulturmiljöer kring Årås.", "3c4d5e6f-7f01-4a92-2345-6789abcdef01", "Vildmarksleden Årås", 8.5, "Grön markering", "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png" },
                    { 5, false, "Asfalt, stig och grusväg", "Lätt", null, "En lättvandrad slinga som kombinerar skogsstigar, grusväg och kortare asfaltspartier.", "4d5e6f70-8012-4b93-3456-789abcdef012", "Gesebol", 6.0, "Röd markering med en 6:a på", "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png" },
                    { 6, false, "Asfalt, stigar och grusväg", "Medel", null, "En medelsvår led med både skogsstigar, grusvägar och öppnare partier.", "5e6f7081-9123-4c94-4567-89abcdef0123", "Hultafors", 4.5, "Blå markering", "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png" },
                    { 7, true, "Asfalt och grusväg", "Lätt", null, "En lätt och tillgänglig led på asfalt och grusväg som passar för alla.", "6f708192-a234-4d95-5678-9abcdef01234", "Nässehult", 4.5, "Nässla", "https://inkaben.se/stigvidd/mock/nassla.png" },
                    { 8, true, "Asfalt, stig och grusväg", "Lätt", null, "En kort och lättvandrad slinga i det vackra området kring Hofsnäs.", "708192a3-b345-4e96-6789-abcdef012345", "Hoffsnäs", 4.7999999999999998, "Läderbagge", "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png" }
                });

            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "Id", "Email", "Identifier", "NickName" },
                values: new object[,]
                {
                    { 1, "natur@example.local", "a01a01a0-1001-4101-8101-000000001001", "NaturElskaren" },
                    { 2, "vandrar@example.local", "a02a02a0-1002-4102-8102-000000001002", "VandrarVennen" },
                    { 3, "fjall@example.local", "a03a03a0-1003-4103-8103-000000001003", "FjällFanatikern" },
                    { 4, "skog@example.local", "a04a04a0-1004-4104-8104-000000001004", "SkogsSpringaren" },
                    { 5, "aventyr@example.local", "a05a05a0-1005-4105-8105-000000001005", "ÄventyrAnna" },
                    { 6, "vildmark@example.local", "a06a06a0-1006-4106-8106-000000001006", "VildmarksViktor" }
                });

            migrationBuilder.InsertData(
                table: "Reviews",
                columns: new[] { "Id", "Grade", "Identifier", "TrailId", "TrailReview", "UserId" },
                values: new object[,]
                {
                    { 1, 5f, "901a1a1a-0101-4111-8111-000000000101", 1, "Tiveden är verkligen utmanande! Branta klippor och fantastisk natur. Mina ben känner fortfarande av det!", 1 },
                    { 2, 4f, "901a1a1a-0102-4112-8112-000000000102", 2, "Storsjöleden var tuffare än förväntat men så vacker! Perfekt träning.", 2 },
                    { 3, 5f, "901a1a1a-0103-4113-8113-000000000103", 3, "Tångaleden är en favorit! Spångarna gör det enklare och utsikten är magisk.", 1 },
                    { 4, 4f, "901a1a1a-0104-4114-8114-000000000104", 4, "Vildmarksleden Årås är mysig! Såg både kor och får längs vägen. Barnvänlig.", 2 },
                    { 5, 4f, "901a1a1a-0105-4115-8115-000000000105", 1, "Tiveden är inget för nybörjare. Ta med vatten och ta det lugnt!", 3 },
                    { 6, 5f, "901a1a1a-0106-4116-8116-000000000106", 1, "Bästa leden i området! Tiveden är krävande men så otroligt vacker med alla klippformationer.", 4 },
                    { 7, 5f, "901a1a1a-0107-4117-8117-000000000107", 2, "Storsjöleden passerar vackra vyer över sjön. Värt ansträngningen!", 5 },
                    { 8, 4f, "901a1a1a-0108-4118-8118-000000000108", 2, "Lite hala stenar på vissa ställen i Storsjöleden, men annars toppen!", 6 },
                    { 9, 4f, "901a1a1a-0109-4119-8119-000000000109", 3, "Tångaleden är perfekt för en avslappnad vandring. Spångarna är välbyggda.", 3 },
                    { 10, 5f, "901a1a1a-0110-4120-8120-000000000110", 3, "Gick Tångaleden i solnedgången - magiskt! Rekommenderas starkt.", 4 },
                    { 11, 5f, "901a1a1a-0111-4121-8121-000000000111", 4, "Årås är superbra för hela familjen! Kan till och med cykla delar av sträckan.", 5 },
                    { 12, 4f, "901a1a1a-0112-4122-8122-000000000112", 4, "Fin blandning av natur och lantbrukslandskap på Vildmarksleden. Väldigt trivsamt!", 1 },
                    { 13, 4f, "901a1a1a-0113-4123-8123-000000000113", 1, "Tiveden utmanade verkligen min kondition. Ta med snacks och vatten!", 6 },
                    { 14, 4f, "901a1a1a-0114-4124-8124-000000000114", 2, "Storsjöleden hade vackra höstfärger när vi gick den. Lite lerig efter regn.", 3 },
                    { 15, 5f, "901a1a1a-0115-4125-8125-000000000115", 3, "Tångaleden är min go-to för en snabb eftermiddagspromenad. Lugnt och skönt!", 6 },
                    { 16, 5f, "901a1a1a-0116-4126-8126-000000000116", 4, "Årås är en underbar led! Grusvägen gör det enkelt och naturen är vacker.", 4 },
                    { 17, 4f, "901a1a1a-0117-4127-8127-000000000117", 1, "Tiveden kräver bra skor med bra grepp. Klipporna kan vara hala!", 5 },
                    { 18, 3f, "901a1a1a-0118-4128-8128-000000000118", 2, "Lite för tuff för mig personligen men vacker natur i Storsjöleden.", 4 },
                    { 19, 3f, "901a1a1a-0119-4129-8129-000000000119", 5, "Gesebol är perfekt för en lugn promenad! Bara asfalt och grusväg men fin natur.", 1 },
                    { 20, 3f, "901a1a1a-0120-4130-8130-000000000120", 5, "Enkel och trevlig led, passar bra för joggingrundan också, mycket platt underlag!", 2 },
                    { 21, 2f, "901a1a1a-0121-4131-8131-000000000121", 5, "Kort och halvmysig tur. Barnen tyckte det var tråkigt med så mkt asfalt.", 3 },
                    { 22, 5f, "901a1a1a-0122-4132-8132-000000000122", 5, "Gesebol är en favorit för kvällspromenader. Lugnt och fridfullt!", 6 },
                    { 23, 4f, "901a1a1a-0123-4133-8133-000000000123", 6, "Hultafors har lite mer utmaning än man tror! Fina stigar genom skogen.", 4 },
                    { 24, 4f, "901a1a1a-0124-4134-8134-000000000124", 6, "Bra träningsrunda! Lite variation i terrängen gör det intressant.", 5 },
                    { 25, 5f, "901a1a1a-0125-4135-8135-000000000125", 6, "Hultafors överraskade positivt. Vacker skogsmark och bra skyltning.", 1 },
                    { 26, 3f, "901a1a1a-0126-4136-8136-000000000126", 6, "Lite för korta stigdelar för min smak men annars trevlig led.", 3 },
                    { 27, 5f, "901a1a1a-0127-4137-8137-000000000127", 7, "Nässehult är absolut bäst för barnvagn! Släta vägar hela vägen.", 2 },
                    { 28, 5f, "901a1a1a-0128-4138-8138-000000000128", 7, "Perfekt tillgänglig led. Kunde köra rullstol utan problem!", 6 },
                    { 29, 4f, "901a1a1a-0129-4139-8139-000000000129", 7, "Enkelt och lättgått. Bra för äldre eller de som behöver tillgänglighet.", 4 },
                    { 30, 4f, "901a1a1a-0130-4140-8140-000000000130", 7, "Nässehult är mysig! Fin promenad längs med bra underlag.", 5 },
                    { 31, 3f, "901a1a1a-0131-4141-8141-000000000131", 5, "Gesebol är på 6 km. Lagom längd men tråkigt med så mkt bilvägar!", 4 },
                    { 32, 4f, "901a1a1a-0132-4142-8142-000000000132", 6, "Hultafors ger lite träning trots att den är kort. Sköna stigar!", 2 }
                });

            migrationBuilder.InsertData(
                table: "TrailImages",
                columns: new[] { "Id", "Identifier", "ImageUrl", "TrailId" },
                values: new object[,]
                {
                    { 1, "810a1a1a-0001-4001-8001-000000000001", "https://inkaben.se/stigvidd/mock/tiveden/20250925122257.jpg", 1 },
                    { 2, "810a1a1a-0002-4002-8002-000000000002", "https://inkaben.se/stigvidd/mock/tiveden/20250925122143.jpg", 1 },
                    { 3, "810a1a1a-0003-4003-8003-000000000003", "https://inkaben.se/stigvidd/mock/tiveden/20250925110314.jpg", 1 },
                    { 4, "810a1a1a-0004-4004-8004-000000000004", "https://inkaben.se/stigvidd/mock/storsjon/20241102113934.jpg", 2 },
                    { 5, "810a1a1a-0005-4005-8005-000000000005", "https://inkaben.se/stigvidd/mock/storsjon/20241102121010.jpg", 2 },
                    { 6, "810a1a1a-0006-4006-8006-000000000006", "https://inkaben.se/stigvidd/mock/storsjon/20241102112335.jpg", 2 },
                    { 7, "810a1a1a-0007-4007-8007-000000000007", "https://inkaben.se/stigvidd/mock/tangaleden/20250902122917.jpg", 3 },
                    { 8, "810a1a1a-0008-4008-8008-000000000008", "https://inkaben.se/stigvidd/mock/tangaleden/20250902130421.jpg", 3 },
                    { 9, "810a1a1a-0009-4009-8009-000000000009", "https://inkaben.se/stigvidd/mock/hofsnas/20250822093635.jpg", 3 },
                    { 10, "810a1a1a-0010-4010-8010-000000000010", "https://inkaben.se/stigvidd/mock/aras/20250818102417.jpg", 4 },
                    { 11, "810a1a1a-0011-4011-8011-000000000011", "https://inkaben.se/stigvidd/mock/aras/20250818094810.jpg", 4 },
                    { 12, "810a1a1a-0012-4012-8012-000000000012", "https://inkaben.se/stigvidd/mock/aras/20250818103640.jpg", 4 },
                    { 13, "810a1a1a-0013-4013-8013-000000000013", "https://inkaben.se/stigvidd/mock/aras/20250818112639.jpg", 4 },
                    { 14, "810a1a1a-0014-4014-8014-000000000014", "https://inkaben.se/stigvidd/mock/gesebol/20250824100243.jpg", 5 },
                    { 15, "810a1a1a-0015-4015-8015-000000000015", "https://inkaben.se/stigvidd/mock/gesebol/20250824105053.jpg", 5 },
                    { 16, "810a1a1a-0016-4016-8016-000000000016", "https://inkaben.se/stigvidd/mock/gesebol/20250824095946.jpg", 5 },
                    { 17, "810a1a1a-0017-4017-8017-000000000017", "https://inkaben.se/stigvidd/mock/gesebol/20250824110936.jpg", 5 },
                    { 18, "810a1a1a-0018-4018-8018-000000000018", "https://inkaben.se/stigvidd/mock/hultafors/20240217105404.jpg", 6 },
                    { 19, "810a1a1a-0019-4019-8019-000000000019", "https://inkaben.se/stigvidd/mock/hultafors/20240217105412.jpg", 6 },
                    { 20, "810a1a1a-0020-4020-8020-000000000020", "https://inkaben.se/stigvidd/mock/hultafors/20240217111003.jpg", 6 },
                    { 21, "810a1a1a-0021-4021-8021-000000000021", "https://inkaben.se/stigvidd/mock/nasslehult/20240119131715.jpg", 7 },
                    { 22, "810a1a1a-0022-4022-8022-000000000022", "https://inkaben.se/stigvidd/mock/nasslehult/20240119132416.jpg", 7 },
                    { 23, "810a1a1a-0023-4023-8023-000000000023", "https://inkaben.se/stigvidd/mock/nasslehult/20240120103723.jpg", 7 },
                    { 24, "810a1a1a-0024-4024-8024-000000000024", "https://inkaben.se/stigvidd/mock/hofsnas/20240912150635.jpg", 8 },
                    { 25, "810a1a1a-0025-4025-8025-000000000025", "https://inkaben.se/stigvidd/mock/hofsnas/20250524103240.jpg", 8 },
                    { 26, "810a1a1a-0026-4026-8026-000000000026", "https://inkaben.se/stigvidd/mock/hofsnas/20250524104329.jpg", 8 },
                    { 27, "810a1a1a-0027-4027-8027-000000000027", "https://inkaben.se/stigvidd/mock/hofsnas/20250822090107.jpg", 8 },
                    { 28, "810a1a1a-0028-4028-8028-000000000028", "https://inkaben.se/stigvidd/mock/hofsnas/20250822090109.jpg", 8 },
                    { 29, "810a1a1a-0029-4029-8029-000000000029", "https://inkaben.se/stigvidd/mock/hofsnas/20250822092315.jpg", 8 },
                    { 30, "810a1a1a-0030-4030-8030-000000000030", "https://inkaben.se/stigvidd/mock/hofsnas/20250822093635.jpg", 8 }
                });

            migrationBuilder.InsertData(
                table: "ReviewImages",
                columns: new[] { "Id", "Identifier", "ImageUrl", "ReviewId" },
                values: new object[,]
                {
                    { 1, "b01b01b0-2001-4201-8201-000000002001", "https://inkaben.se/stigvidd/mock/mock-review/review0011.jpg", 1 },
                    { 2, "b02b02b0-2002-4202-8202-000000002002", "https://inkaben.se/stigvidd/mock/mock-review/review0012.jpg", 1 },
                    { 3, "b03b03b0-2003-4203-8203-000000002003", "https://inkaben.se/stigvidd/mock/mock-review/review0031.jpg", 3 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_ReviewImages_ReviewId",
                table: "ReviewImages",
                column: "ReviewId");

            migrationBuilder.CreateIndex(
                name: "IX_Reviews_TrailId",
                table: "Reviews",
                column: "TrailId");

            migrationBuilder.CreateIndex(
                name: "IX_Reviews_UserId",
                table: "Reviews",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Statistics_UserId",
                table: "Statistics",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TrailImages_TrailId",
                table: "TrailImages",
                column: "TrailId");

            migrationBuilder.CreateIndex(
                name: "IX_TrailLinks_TrailId",
                table: "TrailLinks",
                column: "TrailId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ReviewImages");

            migrationBuilder.DropTable(
                name: "Statistics");

            migrationBuilder.DropTable(
                name: "TrailImages");

            migrationBuilder.DropTable(
                name: "TrailLinks");

            migrationBuilder.DropTable(
                name: "Reviews");

            migrationBuilder.DropTable(
                name: "Trails");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
