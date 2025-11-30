using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
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
                columns: new[] { "Id", "Accessability", "AccessabilityInfo", "Classification", "CoordinatesJson", "Description", "Name", "TrailLenght", "TrailSymbol", "TrailSymbolImage" },
                values: new object[,]
                {
                    { 1, false, "Delvis väldigt svår terräng, kräver god fysik", "Svår", null, "En dramatisk och utmanande vandring genom djupa skogar, höga klippor och stenformationer.", "Tiveden", 9.5, "Röd markering", "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png" },
                    { 2, false, "Delvis väldigt svår terräng, kräver god fysik", "Svår", null, "En varierad och bitvis krävande led som slingrar sig runt Storsjöns skogsområden.", "Storsjöleden", 8.5, "Blå markering", "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png" },
                    { 3, false, "Stigar, spångar och grusväg, vacker utsikt", "Medel", null, "En naturskön rundslinga genom Hofsnäsområdet med blandning av stigar, spångar och öppna utsikter.", "Tångaleden", 9.0999999999999996, "Orange markering", "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png" },
                    { 4, true, "Naturstigar, beteshagar, spång och grusväg", "Medel", null, "En inbjudande led som tar dig genom beteshagar, skogar och kulturmiljöer kring Årås.", "Vildmarksleden Årås", 8.5, "Grön markering", "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png" },
                    { 5, false, "Asfalt, stig och grusväg", "Lätt", null, "En lättvandrad slinga som kombinerar skogsstigar, grusväg och kortare asfaltspartier.", "Gesebol", 6.0, "Röd markering med en 6:a på", "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png" },
                    { 6, false, "Asfalt, stigar och grusväg", "Medel", null, "En medelsvår led med både skogsstigar, grusvägar och öppnare partier.", "Hultafors", 4.5, "Blå markering", "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png" },
                    { 7, true, "Asfalt och grusväg", "Lätt", null, "En lätt och tillgänglig led på asfalt och grusväg som passar för alla.", "Nässehult", 4.5, "Nässla", "https://inkaben.se/stigvidd/mock/nassla.png" },
                    { 8, true, "Asfalt, stig och grusväg", "Lätt", null, "En kort och lättvandrad slinga i det vackra området kring Hofsnäs.", "Hoffsnäs", 4.7999999999999998, "Läderbagge", "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png" }
                });

            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "Id", "Email", "NickName" },
                values: new object[,]
                {
                    { 1, "natur@example.local", "NaturElskaren" },
                    { 2, "vandrar@example.local", "VandrarVennen" },
                    { 3, "fjall@example.local", "FjällFanatikern" },
                    { 4, "skog@example.local", "SkogsSpringaren" },
                    { 5, "aventyr@example.local", "ÄventyrAnna" },
                    { 6, "vildmark@example.local", "VildmarksViktor" }
                });

            migrationBuilder.InsertData(
                table: "Reviews",
                columns: new[] { "Id", "Grade", "TrailId", "TrailReview", "UserId" },
                values: new object[,]
                {
                    { 1, 5f, 1, "Tiveden är verkligen utmanande! Branta klippor och fantastisk natur. Mina ben känner fortfarande av det!", 1 },
                    { 2, 4f, 2, "Storsjöleden var tuffare än förväntat men så vacker! Perfekt träning.", 2 },
                    { 3, 5f, 3, "Tångaleden är en favorit! Spångarna gör det enklare och utsikten är magisk.", 1 },
                    { 4, 4f, 4, "Vildmarksleden Årås är mysig! Såg både kor och får längs vägen. Barnvänlig.", 2 },
                    { 5, 4f, 1, "Tiveden är inget för nybörjare. Ta med vatten och ta det lugnt!", 3 },
                    { 6, 5f, 1, "Bästa leden i området! Tiveden är krävande men så otroligt vacker med alla klippformationer.", 4 },
                    { 7, 5f, 2, "Storsjöleden passerar vackra vyer över sjön. Värt ansträngningen!", 5 },
                    { 8, 4f, 2, "Lite hala stenar på vissa ställen i Storsjöleden, men annars toppen!", 6 },
                    { 9, 4f, 3, "Tångaleden är perfekt för en avslappnad vandring. Spångarna är välbyggda.", 3 },
                    { 10, 5f, 3, "Gick Tångaleden i solnedgången - magiskt! Rekommenderas starkt.", 4 },
                    { 11, 5f, 4, "Årås är superbra för hela familjen! Kan till och med cykla delar av sträckan.", 5 },
                    { 12, 4f, 4, "Fin blandning av natur och lantbrukslandskap på Vildmarksleden. Väldigt trivsamt!", 1 },
                    { 13, 4f, 1, "Tiveden utmanade verkligen min kondition. Ta med snacks och vatten!", 6 },
                    { 14, 4f, 2, "Storsjöleden hade vackra höstfärger när vi gick den. Lite lerig efter regn.", 3 },
                    { 15, 5f, 3, "Tångaleden är min go-to för en snabb eftermiddagspromenad. Lugnt och skönt!", 6 },
                    { 16, 5f, 4, "Årås är en underbar led! Grusvägen gör det enkelt och naturen är vacker.", 4 },
                    { 17, 4f, 1, "Tiveden kräver bra skor med bra grepp. Klipporna kan vara hala!", 5 },
                    { 18, 3f, 2, "Lite för tuff för mig personligen men vacker natur i Storsjöleden.", 4 },
                    { 19, 3f, 5, "Gesebol är perfekt för en lugn promenad! Bara asfalt och grusväg men fin natur.", 1 },
                    { 20, 3f, 5, "Enkel och trevlig led, passar bra för joggingrundan också, mycket platt underlag!", 2 },
                    { 21, 2f, 5, "Kort och halvmysig tur. Barnen tyckte det var tråkigt med så mkt asfalt.", 3 },
                    { 22, 5f, 5, "Gesebol är en favorit för kvällspromenader. Lugnt och fridfullt!", 6 },
                    { 23, 4f, 6, "Hultafors har lite mer utmaning än man tror! Fina stigar genom skogen.", 4 },
                    { 24, 4f, 6, "Bra träningsrunda! Lite variation i terrängen gör det intressant.", 5 },
                    { 25, 5f, 6, "Hultafors överraskade positivt. Vacker skogsmark och bra skyltning.", 1 },
                    { 26, 3f, 6, "Lite för korta stigdelar för min smak men annars trevlig led.", 3 },
                    { 27, 5f, 7, "Nässehult är absolut bäst för barnvagn! Släta vägar hela vägen.", 2 },
                    { 28, 5f, 7, "Perfekt tillgänglig led. Kunde köra rullstol utan problem!", 6 },
                    { 29, 4f, 7, "Enkelt och lättgått. Bra för äldre eller de som behöver tillgänglighet.", 4 },
                    { 30, 4f, 7, "Nässehult är mysig! Fin promenad längs med bra underlag.", 5 },
                    { 31, 3f, 5, "Gesebol är på 6 km. Lagom längd men tråkigt med så mkt bilvägar!", 4 },
                    { 32, 4f, 6, "Hultafors ger lite träning trots att den är kort. Sköna stigar!", 2 }
                });

            migrationBuilder.InsertData(
                table: "TrailImages",
                columns: new[] { "Id", "ImageUrl", "TrailId" },
                values: new object[,]
                {
                    { 1, "https://inkaben.se/stigvidd/mock/tiveden/20250925122257.jpg", 1 },
                    { 2, "https://inkaben.se/stigvidd/mock/tiveden/20250925122143.jpg", 1 },
                    { 3, "https://inkaben.se/stigvidd/mock/tiveden/20250925110314.jpg", 1 },
                    { 4, "https://inkaben.se/stigvidd/mock/storsjon/20241102113934.jpg", 2 },
                    { 5, "https://inkaben.se/stigvidd/mock/storsjon/20241102121010.jpg", 2 },
                    { 6, "https://inkaben.se/stigvidd/mock/storsjon/20241102112335.jpg", 2 },
                    { 7, "https://inkaben.se/stigvidd/mock/tangaleden/20250902122917.jpg", 3 },
                    { 8, "https://inkaben.se/stigvidd/mock/tangaleden/20250902130421.jpg", 3 },
                    { 9, "https://inkaben.se/stigvidd/mock/hofsnas/20250822093635.jpg", 3 },
                    { 10, "https://inkaben.se/stigvidd/mock/aras/20250818102417.jpg", 4 },
                    { 11, "https://inkaben.se/stigvidd/mock/aras/20250818094810.jpg", 4 },
                    { 12, "https://inkaben.se/stigvidd/mock/aras/20250818103640.jpg", 4 },
                    { 13, "https://inkaben.se/stigvidd/mock/aras/20250818112639.jpg", 4 },
                    { 14, "https://inkaben.se/stigvidd/mock/gesebol/20250824100243.jpg", 5 },
                    { 15, "https://inkaben.se/stigvidd/mock/gesebol/20250824105053.jpg", 5 },
                    { 16, "https://inkaben.se/stigvidd/mock/gesebol/20250824095946.jpg", 5 },
                    { 17, "https://inkaben.se/stigvidd/mock/gesebol/20250824110936.jpg", 5 },
                    { 18, "https://inkaben.se/stigvidd/mock/hultafors/20240217105404.jpg", 6 },
                    { 19, "https://inkaben.se/stigvidd/mock/hultafors/20240217105412.jpg", 6 },
                    { 20, "https://inkaben.se/stigvidd/mock/hultafors/20240217111003.jpg", 6 },
                    { 21, "https://inkaben.se/stigvidd/mock/nasslehult/20240119131715.jpg", 7 },
                    { 22, "https://inkaben.se/stigvidd/mock/nasslehult/20240119132416.jpg", 7 },
                    { 23, "https://inkaben.se/stigvidd/mock/nasslehult/20240120103723.jpg", 7 },
                    { 24, "https://inkaben.se/stigvidd/mock/hoffsnas/20240912150635.jpg", 8 },
                    { 25, "https://inkaben.se/stigvidd/mock/hoffsnas/20250524103240.jpg", 8 },
                    { 26, "https://inkaben.se/stigvidd/mock/hoffsnas/20250524104329.jpg", 8 },
                    { 27, "https://inkaben.se/stigvidd/mock/hoffsnas/20250822090107.jpg", 8 },
                    { 28, "https://inkaben.se/stigvidd/mock/hoffsnas/20250822090109.jpg", 8 },
                    { 29, "https://inkaben.se/stigvidd/mock/hoffsnas/20250822092315.jpg", 8 },
                    { 30, "https://inkaben.se/stigvidd/mock/hoffsnas/20250822093635.jpg", 8 }
                });

            migrationBuilder.InsertData(
                table: "ReviewImages",
                columns: new[] { "Id", "ImageUrl", "ReviewId" },
                values: new object[,]
                {
                    { 1, "https://inkaben.se/stigvidd/mock/mock-review/review0011.jpg", 1 },
                    { 2, "https://inkaben.se/stigvidd/mock/mock-review/review0012.jpg", 1 },
                    { 3, "https://inkaben.se/stigvidd/mock/mock-review/review0031.jpg", 3 }
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
