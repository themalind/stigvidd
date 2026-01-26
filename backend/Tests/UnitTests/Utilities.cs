using Infrastructure.Data;
using Infrastructure.Data.Entities;

namespace UnitTests;

// https://github.com/dotnet/AspNetCore.Docs.Samples/blob/main/test/integration-tests/10.x/IntegrationTestsSample/tests/RazorPagesProject.Tests/Helpers/Utilities.cs

/// <summary>
/// Utility class for managing test database seeding and initialization for unit tests.
/// Provides methods to populate the database with predefined test data including various user configurations.
/// </summary>
public static class Utilities
{   /// <summary>
    /// Initializes the database with seed data for unit tests.
    /// Populates the database with predefined trails, users and reviews.
    /// </summary>
    /// <param name="db">The database context to initialize.</param>
    public static void InitializeDbForTests(StigViddDbContext db)
    {
        var trails = GetSeedingTrails();
        var users = GetSeedingUsers(trails);
        var reviews = GetSeedingReviews(trails, users);

        db.Trails.AddRange(trails);
        db.Users.AddRange(users);
        db.Reviews.AddRange(reviews);

        db.SaveChanges();
    }

    /// <summary>
    /// Contains consistent date values used across seed data.
    /// Ensures all test entities have the same creation and update timestamps.
    /// </summary>
    public static class SeedDates
    {
        public static readonly DateTime Created = new DateTime(2025, 1, 1);
        public static readonly DateTime Updated = new DateTime(2025, 1, 1);
    }

    /// <summary>
    /// Creates a collection of predefined trail entities for testing.
    /// Includes various trail types with different classifications, lengths, and accessibility options.
    /// </summary>
    /// <returns>A list of Trail entities with complete test data including images where applicable.</returns>
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
            }
        ];
    }

    /// <summary>
    /// Creates a collection of predefined user entities for testing various scenarios.
    /// Includes 6 different users with different combinations of wishlists and favorites
    /// to test edge cases and different data states.
    /// </summary>
    /// <param name="trails">The list of trails to reference when creating user relationships.</param>
    /// <returns>A list of User entities with varying configurations of wishlists and favorites for comprehensive testing.</returns>
    public static List<User> GetSeedingUsers(List<Trail> trails)
    {
        return new List<User>
        {
            // User 1: Has wishlist items only (no favorites property set)
            new User
            {
                Id = 1,
                Identifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
                FirebaseUid = "firebase-uid-12345",
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
            // User 2: Has favorite items only (no wishlist property set)
            new User
            {
                Id = 2,
                Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
                FirebaseUid = "firebase-uid-12345",
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
            // User 3: Has favorites and explicitly null wishlist
            new User
            {
                Id = 3,
                Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d67",
                FirebaseUid = "firebase-uid-12345",
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
            // User 4: Has wishlist and explicitly null favorites
            new User
            {
                Id = 4,
                Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d22",
                FirebaseUid = "firebase-uid-12345",
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
            // User 5: Has wishlist and empty favorites list
            new User
            {
                Id = 5,
                Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a33",
                FirebaseUid = "firebase-uid-12345",
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
            // User 6: Has favorites and empty wishlist list
            new User
            {
                Id = 6,
                Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a44",
                FirebaseUid = "firebase-uid-12345",
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

    /// <summary>
    /// Creates a collection of predefined review entities for testing.
    /// Includes reviews with varying grades, some with images and different review texts.
    /// </summary>
    /// <param name="trails">The list of trails to reference when creating reviews.</param>
    /// <param name="users">The list of users to reference when creating reviews.</param>
    /// <returns>A list of Review entities with varying configurations for comprehensive testing.</returns>
    public static List<Review> GetSeedingReviews(List<Trail> trails, List<User> users)
    {
        return new List<Review>
    {
        // Review 1: Detailed review with images
        new Review
        {
            Id = 1,
            Identifier = "r1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
            TrailReview = "Fantastisk led! Utmanande terräng men väl värd ansträngningen. Otroliga vyer från klipporna.",
            Grade = 4.5f,
            TrailId = 1, // Tiveden
            UserId = 2,  // VandrarVennen
            CreatedAt = SeedDates.Created,
            LastUpdatedAt = SeedDates.Updated,
            ReviewImages = new List<ReviewImage>
            {
                new ReviewImage
                {
                    Id = 1,
                    Identifier = "rev-img-1",
                    ImageUrl = "https://inkaben.se/stigvidd/mock/review-tiveden-1.jpg",
                    ReviewId = 1
                },
                new ReviewImage
                {
                    Id = 2,
                    Identifier = "rev-img-2",
                    ImageUrl = "https://inkaben.se/stigvidd/mock/review-tiveden-2.jpg",
                    ReviewId = 1
                }
            }
        },
        // Review 2: Short review without images
        new Review
        {
            Id = 2,
            Identifier = "r2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
            TrailReview = "Fin led, lite hal i vissa partier.",
            Grade = 3.5f,
            TrailId = 2, // Storsjöleden
            UserId = 1,  // NaturElskaren
            CreatedAt = SeedDates.Created,
            LastUpdatedAt = SeedDates.Updated
        },
        // Review 3: High rating with detailed feedback
        new Review
        {
            Id = 3,
            Identifier = "r3c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
            TrailReview = "Perfekt för en avkopplande söndagspromenad. Väl markerad och lättgången.",
            Grade = 5.0f,
            TrailId = 7, // Nässehult
            UserId = 6,  // Molgan75
            CreatedAt = SeedDates.Created,
            LastUpdatedAt = SeedDates.Updated
        },
        // Review 4: Medium rating
        new Review
        {
            Id = 4,
            Identifier = "r4d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
            TrailReview = "Bra blandning av terräng. Skulle önska bättre skyltning vid några korsningar.",
            Grade = 3.0f,
            TrailId = 3, // Tångaleden
            UserId = 3,  // SkogsGreven
            CreatedAt = SeedDates.Created,
            LastUpdatedAt = SeedDates.Updated
        },
        // Review 5: Review without text (only grade)
        new Review
        {
            Id = 5,
            Identifier = "r5e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a",
            TrailReview = null,
            Grade = 4.0f,
            TrailId = 4, // Vildmarksleden Årås
            UserId = 5,  // Kattleten
            CreatedAt = SeedDates.Created,
            LastUpdatedAt = SeedDates.Updated
        },
        // Review 6: Multiple reviews on same trail
        new Review
        {
            Id = 6,
            Identifier = "r6f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b",
            TrailReview = "Mysig led genom vacker natur. Tog med barnen och de älskade det!",
            Grade = 4.5f,
            TrailId = 7, // Nässehult (samma som review 3)
            UserId = 1,  // NaturElskaren
            CreatedAt = SeedDates.Created,
            LastUpdatedAt = SeedDates.Updated
        },
        // Review 7: Lower rating with constructive feedback
        new Review
        {
            Id = 7,
            Identifier = "r7a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c",
            TrailReview = "Leden är okej men lite för mycket grus och asfalt för min smak. Saknar mer naturstigar.",
            Grade = 2.5f,
            TrailId = 5, // Gesebol
            UserId = 4,  // Eremiten
            CreatedAt = SeedDates.Created,
            LastUpdatedAt = SeedDates.Updated
        },
        // Review 8: Another detailed review with images
        new Review
        {
            Id = 8,
            Identifier = "r8b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d",
            TrailReview = "Underbar upplevelse! Såg både älg och rådjur. Rekommenderar starkt!",
            Grade = 5.0f,
            TrailId = 1, // Tiveden (samma som review 1)
            UserId = 3,  // SkogsGreven
            CreatedAt = SeedDates.Created,
            LastUpdatedAt = SeedDates.Updated,
            ReviewImages = new List<ReviewImage>
            {
                new ReviewImage
                {
                    Id = 3,
                    Identifier = "rev-img-3",
                    ImageUrl = "https://inkaben.se/stigvidd/mock/review-wildlife.jpg",
                    ReviewId = 8
                }
            }
        }
    };
    }
}
