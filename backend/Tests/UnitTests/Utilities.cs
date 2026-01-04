using Infrastructure.Data;
using Infrastructure.Data.Entities;

namespace UnitTests;

// https://github.com/dotnet/AspNetCore.Docs.Samples/blob/main/test/integration-tests/10.x/IntegrationTestsSample/tests/RazorPagesProject.Tests/Helpers/Utilities.cs

public static class Utilities
{

    public static void InitializeDbForTests(StigViddDbContext db)
    {
        var trails = GetSeedingTrails();
        var users = GetSeedingUsers(trails);

        db.Trails.AddRange(trails);
        db.Users.AddRange(users);

        db.SaveChanges();
    }


    public static void ReinitializeDbForTests(StigViddDbContext db)
    {
        db.Users.RemoveRange(db.Users);
        db.Trails.RemoveRange(db.Trails);

        db.SaveChanges();
        InitializeDbForTests(db);
    }


    public static class SeedDates
    {
        public static readonly DateTime Created = new DateTime(2025, 1, 1);
        public static readonly DateTime Updated = new DateTime(2025, 1, 1);
    }


    public static List<Trail> GetSeedingTrails()
    {
        return
        [
            new Trail
            {
                Id = 1,
                Identifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
                Name = "Tiveden",
                TrailLength = 9.5,
                Classification = "Svår",
                Accessability = false,
                AccessabilityInfo = "Delvis väldigt svår terräng, kräver god fysik",
                Description = "En dramatisk och utmanande vandring genom djupa skogar, höga klippor och stenformationer.",
                TrailSymbol = "Röd markering",
                TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
                CoordinatesJson = null,
                CreatedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow,
                TrailImages = new List<TrailImage>
                {
                    new TrailImage
                    {
                        Id = 1,
                        Identifier = "img-tiveden-1",
                        ImageUrl = "https://inkaben.se/stigvidd/mock/tiveden-forest.jpg",
                        TrailId = 1
                    },
                    new TrailImage
                    {
                        Id = 2,
                        Identifier = "img-tiveden-2",
                        ImageUrl = "https://inkaben.se/stigvidd/mock/tiveden-cliffs.jpg",
                        TrailId = 1
                    },
                    new TrailImage
                    {
                        Id = 3,
                        Identifier = "img-tiveden-3",
                        ImageUrl = "https://inkaben.se/stigvidd/mock/tiveden-lake.jpg",
                        TrailId = 1
                    }
                }
            },
            new Trail
            {
                Id = 2,
                Identifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
                Name = "Storsjöleden",
                TrailLength = 8.5,
                Classification = "Svår",
                Accessability = false,
                AccessabilityInfo = "Delvis väldigt svår terräng, kräver god fysik",
                Description = "En varierad och bitvis krävande led som slingrar sig runt Storsjöns skogsområden.",
                TrailSymbol = "Blå markering",
                TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
                CoordinatesJson = null,
                CreatedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow,
                TrailImages = new List<TrailImage>
                {
                    new TrailImage
                    {
                        Id = 4,
                        Identifier = "img-storlsjon-1",
                        ImageUrl = "https://inkaben.se/stigvidd/mock/storsjoledan-path.jpg",
                        TrailId = 2
                    },
                    new TrailImage
                    {
                        Id = 5,
                        Identifier = "img-storlsjon-2",
                        ImageUrl = "https://inkaben.se/stigvidd/mock/storsjoledan-view.jpg",
                        TrailId = 2
                    }
                }
            },

            new Trail
            {
                Id = 3,
                Identifier = "33c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
                Name = "Tångaleden",
                TrailLength = 9.1,
                Classification = "Medel",
                Accessability = false,
                AccessabilityInfo = "Stigar, spångar och grusväg, vacker utsikt",
                Description = "En naturskön rundslinga genom Hofsnäsområdet med blandning av stigar, spångar och öppna utsikter.",
                TrailSymbol = "Orange markering",
                TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
                CoordinatesJson = null,
                CreatedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow
            },

            new Trail
            {
                Id = 4,
                Identifier = "44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
                Name = "Vildmarksleden Årås",
                TrailLength = 8.5,
                Classification = "Medel",
                Accessability = true,
                AccessabilityInfo = "Naturstigar, beteshagar, spång och grusväg",
                Description = "En inbjudande led som tar dig genom beteshagar, skogar och kulturmiljöer kring Årås.",
                TrailSymbol = "Grön markering",
                TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
                CoordinatesJson = null,
                CreatedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow,
                TrailImages = new List<TrailImage>
                {
                    new TrailImage
                    {
                        Id = 6,
                        Identifier = "img-asdfasdf-1",
                        ImageUrl = "https://inkaben.se/stigvidd/mock/image.jpg",
                        TrailId = 2
                    },
                    new TrailImage
                    {
                        Id = 7,
                        Identifier = "img-asdfasdf-2",
                        ImageUrl = "https://inkaben.se/stigvidd/mock/image.jpg",
                        TrailId = 2
                    }
                }
            },

            new Trail
            {
                Id = 5,
                Identifier = "55e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a",
                Name = "Gesebol",
                TrailLength = 6.0,
                Classification = "Lätt",
                Accessability = false,
                AccessabilityInfo = "Asfalt, stig och grusväg",
                Description = "En lättvandrad slinga som kombinerar skogsstigar, grusväg och kortare asfaltspartier.",
                TrailSymbol = "Röd markering med en 6:a på",
                TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
                CoordinatesJson = null,
                CreatedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow
            },

            new Trail
            {
                Id = 6,
                Identifier = "66f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b",
                Name = "Hultafors",
                TrailLength = 4.5,
                Classification = "Medel",
                Accessability = false,
                AccessabilityInfo = "Asfalt, stigar och grusväg",
                Description = "En medelsvår led med både skogsstigar, grusvägar och öppnare partier.",
                TrailSymbol = "Blå markering",
                TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
                CoordinatesJson = null,
                CreatedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow
            },

            new Trail
            {
                Id = 7,
                Identifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c",
                Name = "Nässehult",
                TrailLength = 4.5,
                Classification = "Lätt",
                Accessability = true,
                AccessabilityInfo = "Asfalt och grusväg",
                Description = "En lätt och tillgänglig led på asfalt och grusväg som passar för alla.",
                TrailSymbol = "Nässla",
                TrailSymbolImage = "https://inkaben.se/stigvidd/mock/nassla.png",
                CoordinatesJson = null,
                CreatedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow,
                TrailImages = new List<TrailImage>
                {
                    new TrailImage
                    {
                        Id = 8,
                        Identifier = "img-asdfasdf-1",
                        ImageUrl = "https://inkaben.se/stigvidd/mock/image.jpg",
                        TrailId = 2
                    },
                    new TrailImage
                    {
                        Id = 9,
                        Identifier = "img-asdfasdf-2",
                        ImageUrl = "https://inkaben.se/stigvidd/mock/image.jpg",
                        TrailId = 2
                    }
                }
            }];

    }

    public static List<User> GetSeedingUsers(List<Trail> trails)
    {
        return new List<User>
        {
            // User 1 har inga Favoriter bara wishlist
            new User
            {
                Id = 1,
                Identifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
                Email = "natur@example.local",
                NickName = "NaturElskaren",
                CreatedAt = SeedDates.Created,
                LastUpdatedAt = SeedDates.Updated,
                MyWishList = new List<Trail>
                {
                    trails.First(t => t.Id == 4), // Vildmarksleden Årås
                    trails.First(t => t.Id == 7)  // Nässehult
                }
            },
            // User 2 har bara Favoriter ingen wishlist
            new User
            {
                Id = 2,
                Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
                Email = "vandrar@example.local",
                NickName = "VandrarVennen",
                CreatedAt = SeedDates.Created,
                LastUpdatedAt = SeedDates.Updated,
                MyFavorites = new List<Trail>
                {
                    trails.First(t => t.Id == 1),
                    trails.First(t => t.Id == 2)
                }
            },

            new User
            {
                Id = 3,
                Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d67",
                Email = "glenn@example.local",
                NickName = "SkogsGreven",
                CreatedAt = SeedDates.Created,
                LastUpdatedAt = SeedDates.Updated,
                MyFavorites = new List<Trail>
                {
                    trails.First(t => t.Id == 4),
                    trails.First(t => t.Id == 3)
                },
                MyWishList = null,
               
            },
            new User
            {
                Id = 4,
                Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d22",
                Email = "artemis@example.local",
                NickName = "Eremiten",
                CreatedAt = SeedDates.Created,
                LastUpdatedAt = SeedDates.Updated,
                MyFavorites = null,
                MyWishList = new List<Trail>
                {
                    trails.First(t => t.Id == 1),
                    trails.First(t => t.Id == 5)
                }, 
            },
            new User
            {
                Id = 5,
                Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a33",
                Email = "ragnar@example.local",
                NickName = "Kattleten",
                CreatedAt = SeedDates.Created,
                LastUpdatedAt = SeedDates.Updated,
                MyFavorites = [],
                MyWishList = new List<Trail>
                {
                    trails.First(t => t.Id == 3),
                    trails.First(t => t.Id == 5)
                },
            },
            new User
            {
                Id = 6,
                Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a44",
                Email = "molgan@example.local",
                NickName = "Molgan75",
                CreatedAt = SeedDates.Created,
                LastUpdatedAt = SeedDates.Updated,
                MyWishList = [],
                MyFavorites = new List<Trail>
                {
                    trails.First(t => t.Id == 3),
                    trails.First(t => t.Id == 5)
                },
            },
        };
    }
}
