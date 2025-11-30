using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;

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
             Name = "Tiveden",
             TrailLenght = 9.5,
             Classification = "Svår",
             Accessability = false,
             AccessabilityInfo = "Delvis väldigt svår terräng, kräver god fysik",
             TrailSymbol = "Röd markering",
             TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
             Description = "En dramatisk och utmanande vandring genom djupa skogar, höga klippor och stenformationer."
         },
        new Trail
        {
            Id = 2,
            Name = "Storsjöleden",
            TrailLenght = 8.5,
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
            Name = "Tångaleden",
            TrailLenght = 9.1,
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
            Name = "Vildmarksleden Årås",
            TrailLenght = 8.5,
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
            Name = "Gesebol",
            TrailLenght = 6,
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
            Name = "Hultafors",
            TrailLenght = 4.5,
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
            Name = "Nässehult",
            TrailLenght = 4.5,
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
            Name = "Hoffsnäs",
            TrailLenght = 4.8,
            Classification = "Lätt",
            Accessability = true,
            AccessabilityInfo = "Asfalt, stig och grusväg",
            TrailSymbol = "Läderbagge",
            TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
            Description = "En kort och lättvandrad slinga i det vackra området kring Hofsnäs."
        });

        modelBuilder.Entity<TrailImage>().HasData(
        // Tiveden
        new TrailImage { Id = 1, TrailId = 1, ImageUrl = "https://inkaben.se/stigvidd/mock/tiveden/20250925122257.jpg" },
        new TrailImage { Id = 2, TrailId = 1, ImageUrl = "https://inkaben.se/stigvidd/mock/tiveden/20250925122143.jpg" },
        new TrailImage { Id = 3, TrailId = 1, ImageUrl = "https://inkaben.se/stigvidd/mock/tiveden/20250925110314.jpg" },

        // Storsjöleden
        new TrailImage { Id = 4, TrailId = 2, ImageUrl = "https://inkaben.se/stigvidd/mock/storsjon/20241102113934.jpg" },
        new TrailImage { Id = 5, TrailId = 2, ImageUrl = "https://inkaben.se/stigvidd/mock/storsjon/20241102121010.jpg" },
        new TrailImage { Id = 6, TrailId = 2, ImageUrl = "https://inkaben.se/stigvidd/mock/storsjon/20241102112335.jpg" },

        // Tångaleden
        new TrailImage { Id = 7, TrailId = 3, ImageUrl = "https://inkaben.se/stigvidd/mock/tangaleden/20250902122917.jpg" },
        new TrailImage { Id = 8, TrailId = 3, ImageUrl = "https://inkaben.se/stigvidd/mock/tangaleden/20250902130421.jpg" },
        new TrailImage { Id = 9, TrailId = 3, ImageUrl = "https://inkaben.se/stigvidd/mock/hofsnas/20250822093635.jpg" },

        // Vildmarksleden Årås
        new TrailImage { Id = 10, TrailId = 4, ImageUrl = "https://inkaben.se/stigvidd/mock/aras/20250818102417.jpg" },
        new TrailImage { Id = 11, TrailId = 4, ImageUrl = "https://inkaben.se/stigvidd/mock/aras/20250818094810.jpg" },
        new TrailImage { Id = 12, TrailId = 4, ImageUrl = "https://inkaben.se/stigvidd/mock/aras/20250818103640.jpg" },
        new TrailImage { Id = 13, TrailId = 4, ImageUrl = "https://inkaben.se/stigvidd/mock/aras/20250818112639.jpg" },

        // Gesebol
        new TrailImage { Id = 14, TrailId = 5, ImageUrl = "https://inkaben.se/stigvidd/mock/gesebol/20250824100243.jpg" },
        new TrailImage { Id = 15, TrailId = 5, ImageUrl = "https://inkaben.se/stigvidd/mock/gesebol/20250824105053.jpg" },
        new TrailImage { Id = 16, TrailId = 5, ImageUrl = "https://inkaben.se/stigvidd/mock/gesebol/20250824095946.jpg" },
        new TrailImage { Id = 17, TrailId = 5, ImageUrl = "https://inkaben.se/stigvidd/mock/gesebol/20250824110936.jpg" },

        // Hultafors
        new TrailImage { Id = 18, TrailId = 6, ImageUrl = "https://inkaben.se/stigvidd/mock/hultafors/20240217105404.jpg" },
        new TrailImage { Id = 19, TrailId = 6, ImageUrl = "https://inkaben.se/stigvidd/mock/hultafors/20240217105412.jpg" },
        new TrailImage { Id = 20, TrailId = 6, ImageUrl = "https://inkaben.se/stigvidd/mock/hultafors/20240217111003.jpg" },

        // Nässehult
        new TrailImage { Id = 21, TrailId = 7, ImageUrl = "https://inkaben.se/stigvidd/mock/nasslehult/20240119131715.jpg" },
        new TrailImage { Id = 22, TrailId = 7, ImageUrl = "https://inkaben.se/stigvidd/mock/nasslehult/20240119132416.jpg" },
        new TrailImage { Id = 23, TrailId = 7, ImageUrl = "https://inkaben.se/stigvidd/mock/nasslehult/20240120103723.jpg" },

        // Hoffsnäs 
        new TrailImage { Id = 24, TrailId = 8, ImageUrl = "https://inkaben.se/stigvidd/mock/hoffsnas/20240912150635.jpg" },
        new TrailImage { Id = 25, TrailId = 8, ImageUrl = "https://inkaben.se/stigvidd/mock/hoffsnas/20250524103240.jpg" },
        new TrailImage { Id = 26, TrailId = 8, ImageUrl = "https://inkaben.se/stigvidd/mock/hoffsnas/20250524104329.jpg" },
        new TrailImage { Id = 27, TrailId = 8, ImageUrl = "https://inkaben.se/stigvidd/mock/hoffsnas/20250822090107.jpg" },
        new TrailImage { Id = 28, TrailId = 8, ImageUrl = "https://inkaben.se/stigvidd/mock/hoffsnas/20250822090109.jpg" },
        new TrailImage { Id = 29, TrailId = 8, ImageUrl = "https://inkaben.se/stigvidd/mock/hoffsnas/20250822092315.jpg" },
        new TrailImage { Id = 30, TrailId = 8, ImageUrl = "https://inkaben.se/stigvidd/mock/hoffsnas/20250822093635.jpg" }
    );

        modelBuilder.Entity<Review>().HasData(
        new Review
        {
            Id = 1,
            TrailReview = "Tiveden är verkligen utmanande! Branta klippor och fantastisk natur. Mina ben känner fortfarande av det!",
            Grade = 5,
            TrailId = 1,
            UserId = 1
        },
        new Review
        {
            Id = 2,
            TrailReview = "Storsjöleden var tuffare än förväntat men så vacker! Perfekt träning.",
            Grade = 4,
            TrailId = 2,
            UserId = 2
        },
        new Review
        {
            Id = 3,
            TrailReview = "Tångaleden är en favorit! Spångarna gör det enklare och utsikten är magisk.",
            Grade = 5,
            TrailId = 3,
            UserId = 1
        },
        new Review
        {
            Id = 4,
            TrailReview = "Vildmarksleden Årås är mysig! Såg både kor och får längs vägen. Barnvänlig.",
            Grade = 4,
            TrailId = 4,
            UserId = 2
        },
        new Review
        {
            Id = 5,
            TrailReview = "Tiveden är inget för nybörjare. Ta med vatten och ta det lugnt!",
            Grade = 4,
            TrailId = 1,
            UserId = 3
        },
        new Review
        {
            Id = 6,
            TrailReview = "Bästa leden i området! Tiveden är krävande men så otroligt vacker med alla klippformationer.",
            Grade = 5,
            TrailId = 1,
            UserId = 4
        },
        new Review
        {
            Id = 7,
            TrailReview = "Storsjöleden passerar vackra vyer över sjön. Värt ansträngningen!",
            Grade = 5,
            TrailId = 2,
            UserId = 5
        },
        new Review
        {
            Id = 8,
            TrailReview = "Lite hala stenar på vissa ställen i Storsjöleden, men annars toppen!",
            Grade = 4,
            TrailId = 2,
            UserId = 6
        },
        new Review
        {
            Id = 9,
            TrailReview = "Tångaleden är perfekt för en avslappnad vandring. Spångarna är välbyggda.",
            Grade = 4,
            TrailId = 3,
            UserId = 3
        },
        new Review
        {
            Id = 10,
            TrailReview = "Gick Tångaleden i solnedgången - magiskt! Rekommenderas starkt.",
            Grade = 5,
            TrailId = 3,
            UserId = 4
        },
        new Review
        {
            Id = 11,
            TrailReview = "Årås är superbra för hela familjen! Kan till och med cykla delar av sträckan.",
            Grade = 5,
            TrailId = 4,
            UserId = 5
        },
        new Review
        {
            Id = 12,
            TrailReview = "Fin blandning av natur och lantbrukslandskap på Vildmarksleden. Väldigt trivsamt!",
            Grade = 4,
            TrailId = 4,
            UserId = 1
        },
        new Review
        {
            Id = 13,
            TrailReview = "Tiveden utmanade verkligen min kondition. Ta med snacks och vatten!",
            Grade = 4,
            TrailId = 1,
            UserId = 6
        },
        new Review
        {
            Id = 14,
            TrailReview = "Storsjöleden hade vackra höstfärger när vi gick den. Lite lerig efter regn.",
            Grade = 4,
            TrailId = 2,
            UserId = 3
        },
        new Review
        {
            Id = 15,
            TrailReview = "Tångaleden är min go-to för en snabb eftermiddagspromenad. Lugnt och skönt!",
            Grade = 5,
            TrailId = 3,
            UserId = 6
        },
        new Review
        {
            Id = 16,
            TrailReview = "Årås är en underbar led! Grusvägen gör det enkelt och naturen är vacker.",
            Grade = 5,
            TrailId = 4,
            UserId = 4
        },
        new Review
        {
            Id = 17,
            TrailReview = "Tiveden kräver bra skor med bra grepp. Klipporna kan vara hala!",
            Grade = 4,
            TrailId = 1,
            UserId = 5
        },
        new Review
        {
            Id = 18,
            TrailReview = "Lite för tuff för mig personligen men vacker natur i Storsjöleden.",
            Grade = 3,
            TrailId = 2,
            UserId = 4
        },
        new Review
        {
            Id = 19,
            TrailReview = "Gesebol är perfekt för en lugn promenad! Bara asfalt och grusväg men fin natur.",
            Grade = 3,
            TrailId = 5,
            UserId = 1
        },
        new Review
        {
            Id = 20,
            TrailReview = "Enkel och trevlig led, passar bra för joggingrundan också, mycket platt underlag!",
            Grade = 3,
            TrailId = 5,
            UserId = 2
        },
        new Review
        {
            Id = 21,
            TrailReview = "Kort och halvmysig tur. Barnen tyckte det var tråkigt med så mkt asfalt.",
            Grade = 2,
            TrailId = 5,
            UserId = 3
        },
        new Review
        {
            Id = 22,
            TrailReview = "Gesebol är en favorit för kvällspromenader. Lugnt och fridfullt!",
            Grade = 5,
            TrailId = 5,
            UserId = 6
        },
        new Review
        {
            Id = 23,
            TrailReview = "Hultafors har lite mer utmaning än man tror! Fina stigar genom skogen.",
            Grade = 4,
            TrailId = 6,
            UserId = 4
        },
        new Review
        {
            Id = 24,
            TrailReview = "Bra träningsrunda! Lite variation i terrängen gör det intressant.",
            Grade = 4,
            TrailId = 6,
            UserId = 5
        },
        new Review
        {
            Id = 25,
            TrailReview = "Hultafors överraskade positivt. Vacker skogsmark och bra skyltning.",
            Grade = 5,
            TrailId = 6,
            UserId = 1
        },
        new Review
        {
            Id = 26,
            TrailReview = "Lite för korta stigdelar för min smak men annars trevlig led.",
            Grade = 3,
            TrailId = 6,
            UserId = 3
        },
        new Review
        {
            Id = 27,
            TrailReview = "Nässehult är absolut bäst för barnvagn! Släta vägar hela vägen.",
            Grade = 5,
            TrailId = 7,
            UserId = 2
        },
        new Review
        {
            Id = 28,
            TrailReview = "Perfekt tillgänglig led. Kunde köra rullstol utan problem!",
            Grade = 5,
            TrailId = 7,
            UserId = 6
        },
        new Review
        {
            Id = 29,
            TrailReview = "Enkelt och lättgått. Bra för äldre eller de som behöver tillgänglighet.",
            Grade = 4,
            TrailId = 7,
            UserId = 4
        },
        new Review
        {
            Id = 30,
            TrailReview = "Nässehult är mysig! Fin promenad längs med bra underlag.",
            Grade = 4,
            TrailId = 7,
            UserId = 5
        },
        new Review
        {
            Id = 31,
            TrailReview = "Gesebol är på 6 km. Lagom längd men tråkigt med så mkt bilvägar!",
            Grade = 3,
            TrailId = 5,
            UserId = 4
        },
        new Review
        {
            Id = 32,
            TrailReview = "Hultafors ger lite träning trots att den är kort. Sköna stigar!",
            Grade = 4,
            TrailId = 6,
            UserId = 2
        }
        );
        modelBuilder.Entity<User>().HasData(
        new User { Id = 1, NickName = "NaturElskaren", Email = "natur@example.local" },
        new User { Id = 2, NickName = "VandrarVennen", Email = "vandrar@example.local" },
        new User { Id = 3, NickName = "FjällFanatikern", Email = "fjall@example.local" },
        new User { Id = 4, NickName = "SkogsSpringaren", Email = "skog@example.local" },
        new User { Id = 5, NickName = "ÄventyrAnna", Email = "aventyr@example.local" },
        new User { Id = 6, NickName = "VildmarksViktor", Email = "vildmark@example.local" }
        );

        modelBuilder.Entity<ReviewImage>().HasData(
        new ReviewImage
        {
            Id = 1,
            ImageUrl = "https://inkaben.se/stigvidd/mock/mock-review/review0011.jpg",
            ReviewId = 1,
        },
         new ReviewImage
         {
             Id = 2,
             ImageUrl = "https://inkaben.se/stigvidd/mock/mock-review/review0012.jpg",
             ReviewId = 1,
         },
         new ReviewImage
         {
             Id = 3,
             ImageUrl = "https://inkaben.se/stigvidd/mock/mock-review/review0031.jpg",
             ReviewId = 3,
         });


    }

}