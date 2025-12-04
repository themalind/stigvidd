using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Data;

public class StigViddDbContext : DbContext
{
    public StigViddDbContext(DbContextOptions<StigViddDbContext> options)
        : base(options)
    {
    }

    public DbSet<Trail> Trails { get; set; }
    public DbSet<TrailImage> TrailImages { get; set; }
    public DbSet<TrailLink> TrailLinks { get; set; }
    public DbSet<Review> Reviews { get; set; }
    public DbSet<ReviewImage> ReviewImages { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<Statistics> Statistics { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Trail>().HasData(
        new Trail
        {
            Id = 1,
            Identifier = "0f8fad5b-d9cb-469f-a165-70867728950e",
            Name = "Tiveden",
            TrailLength = 9.5,
            Classification = "Svår",
            Accessability = false,
            AccessabilityInfo = "Delvis väldigt svår terräng, kräver god fysik",
            TrailSymbol = "Röd markering",
            TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
            Description = "En dramatisk och utmanande vandring genom djupa skogar, höga klippor och stenformationer.",
        },
        new Trail
        {
            Id = 2,
            Identifier = "1a2b3c4d-5e6f-4789-0123-456789abcdef",
            Name = "Storsjöleden",
            TrailLength = 8.5,
            Classification = "Svår",
            Accessability = false,
            AccessabilityInfo = "Delvis väldigt svår terräng, kräver god fysik",
            TrailSymbol = "Blå markering",
            TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
            Description = "En varierad och bitvis krävande led som slingrar sig runt Storsjöns skogsområden."
        },
        new Trail
        {
            Id = 3,
            Identifier = "2b3c4d5e-6f70-4891-1234-56789abcdef0",
            Name = "Tångaleden",
            TrailLength = 9.1,
            Classification = "Medel",
            Accessability = false,
            AccessabilityInfo = "Stigar, spångar och grusväg, vacker utsikt",
            TrailSymbol = "Orange markering",
            TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
            Description = "En naturskön rundslinga genom Hofsnäsområdet med blandning av stigar, spångar och öppna utsikter."
        },
        new Trail
        {
            Id = 4,
            Identifier = "3c4d5e6f-7f01-4a92-2345-6789abcdef01",
            Name = "Vildmarksleden Årås",
            TrailLength = 8.5,
            Classification = "Medel",
            Accessability = true,
            AccessabilityInfo = "Naturstigar, beteshagar, spång och grusväg",
            TrailSymbol = "Grön markering",
            TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
            Description = "En inbjudande led som tar dig genom beteshagar, skogar och kulturmiljöer kring Årås."
        },
        new Trail
        {
            Id = 5,
            Identifier = "4d5e6f70-8012-4b93-3456-789abcdef012",
            Name = "Gesebol",
            TrailLength = 6,
            Classification = "Lätt",
            Accessability = false,
            AccessabilityInfo = "Asfalt, stig och grusväg",
            TrailSymbol = "Röd markering med en 6:a på",
            TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
            Description = "En lättvandrad slinga som kombinerar skogsstigar, grusväg och kortare asfaltspartier."
        },
        new Trail
        {
            Id = 6,
            Identifier = "5e6f7081-9123-4c94-4567-89abcdef0123",
            Name = "Hultafors",
            TrailLength = 4.5,
            Classification = "Medel",
            Accessability = false,
            AccessabilityInfo = "Asfalt, stigar och grusväg",
            TrailSymbol = "Blå markering",
            TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
            Description = "En medelsvår led med både skogsstigar, grusvägar och öppnare partier."
        },
        new Trail
        {
            Id = 7,
            Identifier = "6f708192-a234-4d95-5678-9abcdef01234",
            Name = "Nässehult",
            TrailLength = 4.5,
            Classification = "Lätt",
            Accessability = true,
            AccessabilityInfo = "Asfalt och grusväg",
            TrailSymbol = "Nässla",
            TrailSymbolImage = "https://inkaben.se/stigvidd/mock/nassla.png",
            Description = "En lätt och tillgänglig led på asfalt och grusväg som passar för alla."
        },
        new Trail
        {
            Id = 8,
            Identifier = "708192a3-b345-4e96-6789-abcdef012345",
            Name = "Hoffsnäs",
            TrailLength = 4.8,
            Classification = "Lätt",
            Accessability = true,
            AccessabilityInfo = "Asfalt, stig och grusväg",
            TrailSymbol = "Läderbagge",
            TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
            Description = "En kort och lättvandrad slinga i det vackra området kring Hofsnäs."
        });

        modelBuilder.Entity<TrailImage>().HasData(
        // Tiveden
        new TrailImage { Id = 1, Identifier = "810a1a1a-0001-4001-8001-000000000001", TrailId = 1, ImageUrl = "https://inkaben.se/stigvidd/mock/tiveden/20250925122257.jpg" },
        new TrailImage { Id = 2, Identifier = "810a1a1a-0002-4002-8002-000000000002", TrailId = 1, ImageUrl = "https://inkaben.se/stigvidd/mock/tiveden/20250925122143.jpg" },
        new TrailImage { Id = 3, Identifier = "810a1a1a-0003-4003-8003-000000000003", TrailId = 1, ImageUrl = "https://inkaben.se/stigvidd/mock/tiveden/20250925110314.jpg" },

        // Storsjöleden
        new TrailImage { Id = 4, Identifier = "810a1a1a-0004-4004-8004-000000000004", TrailId = 2, ImageUrl = "https://inkaben.se/stigvidd/mock/storsjon/20241102113934.jpg" },
        new TrailImage { Id = 5, Identifier = "810a1a1a-0005-4005-8005-000000000005", TrailId = 2, ImageUrl = "https://inkaben.se/stigvidd/mock/storsjon/20241102121010.jpg" },
        new TrailImage { Id = 6, Identifier = "810a1a1a-0006-4006-8006-000000000006", TrailId = 2, ImageUrl = "https://inkaben.se/stigvidd/mock/storsjon/20241102112335.jpg" },

        // Tångaleden
        new TrailImage { Id = 7, Identifier = "810a1a1a-0007-4007-8007-000000000007", TrailId = 3, ImageUrl = "https://inkaben.se/stigvidd/mock/tangaleden/20250902122917.jpg" },
        new TrailImage { Id = 8, Identifier = "810a1a1a-0008-4008-8008-000000000008", TrailId = 3, ImageUrl = "https://inkaben.se/stigvidd/mock/tangaleden/20250902130421.jpg" },
        new TrailImage { Id = 9, Identifier = "810a1a1a-0009-4009-8009-000000000009", TrailId = 3, ImageUrl = "https://inkaben.se/stigvidd/mock/hofsnas/20250822093635.jpg" },

        // Vildmarksleden Årås
        new TrailImage { Id = 10, Identifier = "810a1a1a-0010-4010-8010-000000000010", TrailId = 4, ImageUrl = "https://inkaben.se/stigvidd/mock/aras/20250818102417.jpg" },
        new TrailImage { Id = 11, Identifier = "810a1a1a-0011-4011-8011-000000000011", TrailId = 4, ImageUrl = "https://inkaben.se/stigvidd/mock/aras/20250818094810.jpg" },
        new TrailImage { Id = 12, Identifier = "810a1a1a-0012-4012-8012-000000000012", TrailId = 4, ImageUrl = "https://inkaben.se/stigvidd/mock/aras/20250818103640.jpg" },
        new TrailImage { Id = 13, Identifier = "810a1a1a-0013-4013-8013-000000000013", TrailId = 4, ImageUrl = "https://inkaben.se/stigvidd/mock/aras/20250818112639.jpg" },

        // Gesebol
        new TrailImage { Id = 14, Identifier = "810a1a1a-0014-4014-8014-000000000014", TrailId = 5, ImageUrl = "https://inkaben.se/stigvidd/mock/gesebol/20250824100243.jpg" },
        new TrailImage { Id = 15, Identifier = "810a1a1a-0015-4015-8015-000000000015", TrailId = 5, ImageUrl = "https://inkaben.se/stigvidd/mock/gesebol/20250824105053.jpg" },
        new TrailImage { Id = 16, Identifier = "810a1a1a-0016-4016-8016-000000000016", TrailId = 5, ImageUrl = "https://inkaben.se/stigvidd/mock/gesebol/20250824095946.jpg" },
        new TrailImage { Id = 17, Identifier = "810a1a1a-0017-4017-8017-000000000017", TrailId = 5, ImageUrl = "https://inkaben.se/stigvidd/mock/gesebol/20250824110936.jpg" },

        // Hultafors
        new TrailImage { Id = 18, Identifier = "810a1a1a-0018-4018-8018-000000000018", TrailId = 6, ImageUrl = "https://inkaben.se/stigvidd/mock/hultafors/20240217105404.jpg" },
        new TrailImage { Id = 19, Identifier = "810a1a1a-0019-4019-8019-000000000019", TrailId = 6, ImageUrl = "https://inkaben.se/stigvidd/mock/hultafors/20240217105412.jpg" },
        new TrailImage { Id = 20, Identifier = "810a1a1a-0020-4020-8020-000000000020", TrailId = 6, ImageUrl = "https://inkaben.se/stigvidd/mock/hultafors/20240217111003.jpg" },

        // Nässehult
        new TrailImage { Id = 21, Identifier = "810a1a1a-0021-4021-8021-000000000021", TrailId = 7, ImageUrl = "https://inkaben.se/stigvidd/mock/nasslehult/20240119131715.jpg" },
        new TrailImage { Id = 22, Identifier = "810a1a1a-0022-4022-8022-000000000022", TrailId = 7, ImageUrl = "https://inkaben.se/stigvidd/mock/nasslehult/20240119132416.jpg" },
        new TrailImage { Id = 23, Identifier = "810a1a1a-0023-4023-8023-000000000023", TrailId = 7, ImageUrl = "https://inkaben.se/stigvidd/mock/nasslehult/20240120103723.jpg" },

        // Hoffsnäs 
        new TrailImage { Id = 24, Identifier = "810a1a1a-0024-4024-8024-000000000024", TrailId = 8, ImageUrl = "https://inkaben.se/stigvidd/mock/hofsnas/20240912150635.jpg" },
        new TrailImage { Id = 25, Identifier = "810a1a1a-0025-4025-8025-000000000025", TrailId = 8, ImageUrl = "https://inkaben.se/stigvidd/mock/hofsnas/20250524103240.jpg" },
        new TrailImage { Id = 26, Identifier = "810a1a1a-0026-4026-8026-000000000026", TrailId = 8, ImageUrl = "https://inkaben.se/stigvidd/mock/hofsnas/20250524104329.jpg" },
        new TrailImage { Id = 27, Identifier = "810a1a1a-0027-4027-8027-000000000027", TrailId = 8, ImageUrl = "https://inkaben.se/stigvidd/mock/hofsnas/20250822090107.jpg" },
        new TrailImage { Id = 28, Identifier = "810a1a1a-0028-4028-8028-000000000028", TrailId = 8, ImageUrl = "https://inkaben.se/stigvidd/mock/hofsnas/20250822090109.jpg" },
        new TrailImage { Id = 29, Identifier = "810a1a1a-0029-4029-8029-000000000029", TrailId = 8, ImageUrl = "https://inkaben.se/stigvidd/mock/hofsnas/20250822092315.jpg" },
        new TrailImage { Id = 30, Identifier = "810a1a1a-0030-4030-8030-000000000030", TrailId = 8, ImageUrl = "https://inkaben.se/stigvidd/mock/hofsnas/20250822093635.jpg" }
    );

        modelBuilder.Entity<Review>().HasData(
        new Review
        {
            Id = 1,
            Identifier = "901a1a1a-0101-4111-8111-000000000101",
            TrailReview = "Tiveden är verkligen utmanande! Branta klippor och fantastisk natur. Mina ben känner fortfarande av det!",
            Grade = 5,
            TrailId = 1,
            UserId = 1
        },
        new Review
        {
            Id = 2,
            Identifier = "901a1a1a-0102-4112-8112-000000000102",
            TrailReview = "Storsjöleden var tuffare än förväntat men så vacker! Perfekt träning.",
            Grade = 4,
            TrailId = 2,
            UserId = 2
        },
        new Review
        {
            Id = 3,
            Identifier = "901a1a1a-0103-4113-8113-000000000103",
            TrailReview = "Tångaleden är en favorit! Spångarna gör det enklare och utsikten är magisk.",
            Grade = 5,
            TrailId = 3,
            UserId = 1
        },
        new Review
        {
            Id = 4,
            Identifier = "901a1a1a-0104-4114-8114-000000000104",
            TrailReview = "Vildmarksleden Årås är mysig! Såg både kor och får längs vägen. Barnvänlig.",
            Grade = 4,
            TrailId = 4,
            UserId = 2
        },
        new Review
        {
            Id = 5,
            Identifier = "901a1a1a-0105-4115-8115-000000000105",
            TrailReview = "Tiveden är inget för nybörjare. Ta med vatten och ta det lugnt!",
            Grade = 4,
            TrailId = 1,
            UserId = 3
        },
        new Review
        {
            Id = 6,
            Identifier = "901a1a1a-0106-4116-8116-000000000106",
            TrailReview = "Bästa leden i området! Tiveden är krävande men så otroligt vacker med alla klippformationer.",
            Grade = 5,
            TrailId = 1,
            UserId = 4
        },
        new Review
        {
            Id = 7,
            Identifier = "901a1a1a-0107-4117-8117-000000000107",
            TrailReview = "Storsjöleden passerar vackra vyer över sjön. Värt ansträngningen!",
            Grade = 5,
            TrailId = 2,
            UserId = 5
        },
        new Review
        {
            Id = 8,
            Identifier = "901a1a1a-0108-4118-8118-000000000108",
            TrailReview = "Lite hala stenar på vissa ställen i Storsjöleden, men annars toppen!",
            Grade = 4,
            TrailId = 2,
            UserId = 6
        },
        new Review
        {
            Id = 9,
            Identifier = "901a1a1a-0109-4119-8119-000000000109",
            TrailReview = "Tångaleden är perfekt för en avslappnad vandring. Spångarna är välbyggda.",
            Grade = 4,
            TrailId = 3,
            UserId = 3
        },
        new Review
        {
            Id = 10,
            Identifier = "901a1a1a-0110-4120-8120-000000000110",
            TrailReview = "Gick Tångaleden i solnedgången - magiskt! Rekommenderas starkt.",
            Grade = 5,
            TrailId = 3,
            UserId = 4
        },
        new Review
        {
            Id = 11,
            Identifier = "901a1a1a-0111-4121-8121-000000000111",
            TrailReview = "Årås är superbra för hela familjen! Kan till och med cykla delar av sträckan.",
            Grade = 5,
            TrailId = 4,
            UserId = 5
        },
        new Review
        {
            Id = 12,
            Identifier = "901a1a1a-0112-4122-8122-000000000112",
            TrailReview = "Fin blandning av natur och lantbrukslandskap på Vildmarksleden. Väldigt trivsamt!",
            Grade = 4,
            TrailId = 4,
            UserId = 1
        },
        new Review
        {
            Id = 13,
            Identifier = "901a1a1a-0113-4123-8123-000000000113",
            TrailReview = "Tiveden utmanade verkligen min kondition. Ta med snacks och vatten!",
            Grade = 4,
            TrailId = 1,
            UserId = 6
        },
        new Review
        {
            Id = 14,
            Identifier = "901a1a1a-0114-4124-8124-000000000114",
            TrailReview = "Storsjöleden hade vackra höstfärger när vi gick den. Lite lerig efter regn.",
            Grade = 4,
            TrailId = 2,
            UserId = 3
        },
        new Review
        {
            Id = 15,
            Identifier = "901a1a1a-0115-4125-8125-000000000115",
            TrailReview = "Tångaleden är min go-to för en snabb eftermiddagspromenad. Lugnt och skönt!",
            Grade = 5,
            TrailId = 3,
            UserId = 6
        },
        new Review
        {
            Id = 16,
            Identifier = "901a1a1a-0116-4126-8126-000000000116",
            TrailReview = "Årås är en underbar led! Grusvägen gör det enkelt och naturen är vacker.",
            Grade = 5,
            TrailId = 4,
            UserId = 4
        },
        new Review
        {
            Id = 17,
            Identifier = "901a1a1a-0117-4127-8127-000000000117",
            TrailReview = "Tiveden kräver bra skor med bra grepp. Klipporna kan vara hala!",
            Grade = 4,
            TrailId = 1,
            UserId = 5
        },
        new Review
        {
            Id = 18,
            Identifier = "901a1a1a-0118-4128-8128-000000000118",
            TrailReview = "Lite för tuff för mig personligen men vacker natur i Storsjöleden.",
            Grade = 3,
            TrailId = 2,
            UserId = 4
        },
        new Review
        {
            Id = 19,
            Identifier = "901a1a1a-0119-4129-8129-000000000119",
            TrailReview = "Gesebol är perfekt för en lugn promenad! Bara asfalt och grusväg men fin natur.",
            Grade = 3,
            TrailId = 5,
            UserId = 1
        },
        new Review
        {
            Id = 20,
            Identifier = "901a1a1a-0120-4130-8130-000000000120",
            TrailReview = "Enkel och trevlig led, passar bra för joggingrundan också, mycket platt underlag!",
            Grade = 3,
            TrailId = 5,
            UserId = 2
        },
        new Review
        {
            Id = 21,
            Identifier = "901a1a1a-0121-4131-8131-000000000121",
            TrailReview = "Kort och halvmysig tur. Barnen tyckte det var tråkigt med så mkt asfalt.",
            Grade = 2,
            TrailId = 5,
            UserId = 3
        },
        new Review
        {
            Id = 22,
            Identifier = "901a1a1a-0122-4132-8132-000000000122",
            TrailReview = "Gesebol är en favorit för kvällspromenader. Lugnt och fridfullt!",
            Grade = 5,
            TrailId = 5,
            UserId = 6
        },
        new Review
        {
            Id = 23,
            Identifier = "901a1a1a-0123-4133-8133-000000000123",
            TrailReview = "Hultafors har lite mer utmaning än man tror! Fina stigar genom skogen.",
            Grade = 4,
            TrailId = 6,
            UserId = 4
        },
        new Review
        {
            Id = 24,
            Identifier = "901a1a1a-0124-4134-8134-000000000124",
            TrailReview = "Bra träningsrunda! Lite variation i terrängen gör det intressant.",
            Grade = 4,
            TrailId = 6,
            UserId = 5
        },
        new Review
        {
            Id = 25,
            Identifier = "901a1a1a-0125-4135-8135-000000000125",
            TrailReview = "Hultafors överraskade positivt. Vacker skogsmark och bra skyltning.",
            Grade = 5,
            TrailId = 6,
            UserId = 1
        },
        new Review
        {
            Id = 26,
            Identifier = "901a1a1a-0126-4136-8136-000000000126",
            TrailReview = "Lite för korta stigdelar för min smak men annars trevlig led.",
            Grade = 3,
            TrailId = 6,
            UserId = 3
        },
        new Review
        {
            Id = 27,
            Identifier = "901a1a1a-0127-4137-8137-000000000127",
            TrailReview = "Nässehult är absolut bäst för barnvagn! Släta vägar hela vägen.",
            Grade = 5,
            TrailId = 7,
            UserId = 2
        },
        new Review
        {
            Id = 28,
            Identifier = "901a1a1a-0128-4138-8138-000000000128",
            TrailReview = "Perfekt tillgänglig led. Kunde köra rullstol utan problem!",
            Grade = 5,
            TrailId = 7,
            UserId = 6
        },
        new Review
        {
            Id = 29,
            Identifier = "901a1a1a-0129-4139-8139-000000000129",
            TrailReview = "Enkelt och lättgått. Bra för äldre eller de som behöver tillgänglighet.",
            Grade = 4,
            TrailId = 7,
            UserId = 4
        },
        new Review
        {
            Id = 30,
            Identifier = "901a1a1a-0130-4140-8140-000000000130",
            TrailReview = "Nässehult är mysig! Fin promenad längs med bra underlag.",
            Grade = 4,
            TrailId = 7,
            UserId = 5
        },
        new Review
        {
            Id = 31,
            Identifier = "901a1a1a-0131-4141-8141-000000000131",
            TrailReview = "Gesebol är på 6 km. Lagom längd men tråkigt med så mkt bilvägar!",
            Grade = 3,
            TrailId = 5,
            UserId = 4
        },
        new Review
        {
            Id = 32,
            Identifier = "901a1a1a-0132-4142-8142-000000000132",
            TrailReview = "Hultafors ger lite träning trots att den är kort. Sköna stigar!",
            Grade = 4,
            TrailId = 6,
            UserId = 2
        }
        );
        modelBuilder.Entity<User>().HasData(
        new User { Id = 1, Identifier = "a01a01a0-1001-4101-8101-000000001001", NickName = "NaturElskaren", Email = "natur@example.local" },
        new User { Id = 2, Identifier = "a02a02a0-1002-4102-8102-000000001002", NickName = "VandrarVennen", Email = "vandrar@example.local" },
        new User { Id = 3, Identifier = "a03a03a0-1003-4103-8103-000000001003", NickName = "FjällFanatikern", Email = "fjall@example.local" },
        new User { Id = 4, Identifier = "a04a04a0-1004-4104-8104-000000001004", NickName = "SkogsSpringaren", Email = "skog@example.local" },
        new User { Id = 5, Identifier = "a05a05a0-1005-4105-8105-000000001005", NickName = "ÄventyrAnna", Email = "aventyr@example.local" },
        new User { Id = 6, Identifier = "a06a06a0-1006-4106-8106-000000001006", NickName = "VildmarksViktor", Email = "vildmark@example.local" }
        );

        modelBuilder.Entity<ReviewImage>().HasData(
        new ReviewImage
        {
            Id = 1,
            Identifier = "b01b01b0-2001-4201-8201-000000002001",
            ImageUrl = "https://inkaben.se/stigvidd/mock/mock-review/review0011.jpg",
            ReviewId = 1,
        },
         new ReviewImage
         {
             Id = 2,
             Identifier = "b02b02b0-2002-4202-8202-000000002002",
             ImageUrl = "https://inkaben.se/stigvidd/mock/mock-review/review0012.jpg",
             ReviewId = 1,
         },
         new ReviewImage
         {
             Id = 3,
             Identifier = "b03b03b0-2003-4203-8203-000000002003",
             ImageUrl = "https://inkaben.se/stigvidd/mock/mock-review/review0031.jpg",
             ReviewId = 3,
         });


    }

}