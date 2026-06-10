using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.AspNetCore.Http;
using Moq;
using System.Linq.Expressions;
using System.Text;
using UserResponseModel = WebDataContracts.ResponseModels.User.UserResponse;

namespace UnitTests;

// https://github.com/dotnet/AspNetCore.Docs.Samples/blob/main/test/integration-tests/10.x/IntegrationTestsSample/tests/RazorPagesProject.Tests/Helpers/Utilities.cs

public static class Utilities
{
    public static void InitializeDbForTests(StigViddDbContext db)
    {
        var trails = GetSeedingTrails();
        var users = GetSeedingUsers(trails);
        var reviews = GetSeedingReviews(trails, users);
        var hikes = GetSeedingHikes(users);
        var obstacles = GetSeedingTrailObstacles(trails, users);
        var solvedVotes = GetSeedingTrailObstacleSolvedVotes(obstacles, users);
        var facilities = GetSeedingFacilities();
        var hikeShares = GetSeedingHikeShares();
        var friendRequests = GetSeedingFriendRequests();

        db.Trails.AddRange(trails);
        db.Users.AddRange(users);
        db.Reviews.AddRange(reviews);
        db.Hikes.AddRange(hikes);
        db.TrailObstacles.AddRange(obstacles);
        db.TrailObstacleSolvedVotes.AddRange(solvedVotes);
        db.Facilities.AddRange(facilities);
        db.HikeShares.AddRange(hikeShares);
        db.FriendRequests.AddRange(friendRequests);
        db.SaveChanges();
    }

    public static class SeedDates
    {
        public static readonly DateTime Created = new DateTime(2025, 1, 1);
        public static readonly DateTime Updated = new DateTime(2025, 1, 1);
    }

    public static List<Trail> GetSeedingTrails()
    {
        var coordinates = "[{ latitude=57.62141010663575, longitude= 12.805517126805371,}]";
        var tags = "[\"skog\", \"sjö\", \"klippor\", \"vildmark\"]";

        return
        [
            new Trail
            {
                Id = 1,
                Identifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
                Name = "Tiveden",
                TrailLength = 9.5M,
                Classification = 3,
                Accessibility = false,
                AccessibilityInfo = "Delvis väldigt svår terräng, kräver god fysik",
                Description = "En dramatisk och utmanande vandring genom djupa skogar, höga klippor och stenformationer.",
                FullDescription = string.Empty,
                TrailSymbol = "Röd markering",
                TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
                Coordinates = coordinates,
                Tags = tags,
                City = "Tiveden",
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
                TrailLength = 8.5M,
                Classification = 3,
                Accessibility = false,
                AccessibilityInfo = "Delvis väldigt svår terräng, kräver god fysik",
                Description = "En varierad och bitvis krävande led som slingrar sig runt Storsjöns skogsområden.",
                FullDescription = string.Empty,
                TrailSymbol = "Blå markering",
                TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
                Coordinates = coordinates,
                Tags = tags,
                IsVerified = true,
                City = "Viskafors",
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
                TrailLength = 9.1M,
                Classification = 2,
                Accessibility = false,
                AccessibilityInfo = "Stigar, spångar och grusväg, vacker utsikt",
                Description = "En naturskön rundslinga genom Hofsnäsområdet med blandning av stigar, spångar och öppna utsikter.",
                FullDescription = string.Empty,
                TrailSymbol = "Orange markering",
                TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
                Coordinates = coordinates,
                Tags = tags,
                IsVerified = true,
                City = "Dannike",
                CreatedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow
            },
            new Trail
            {
                Id = 4,
                Identifier = "44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
                Name = "Vildmarksleden Årås",
                TrailLength = 8.5M,
                Classification = 2,
                Accessibility = true,
                AccessibilityInfo = "Naturstigar, beteshagar, spång och grusväg",
                Description = "En inbjudande led som tar dig genom beteshagar, skogar och kulturmiljöer kring Årås.",
                FullDescription = string.Empty,
                TrailSymbol = "Grön markering",
                TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
                Coordinates = coordinates,
                Tags = tags,
                IsVerified = true,
                City = "Arås",
                CreatedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow,
                TrailImages = new List<TrailImage>
                {
                    new TrailImage
                    {
                        Id = 6,
                        Identifier = "img-aras-1",
                        ImageUrl = "https://inkaben.se/stigvidd/mock/image.jpg",
                        TrailId = 4
                    },
                    new TrailImage
                    {
                        Id = 7,
                        Identifier = "img-aras-2",
                        ImageUrl = "https://inkaben.se/stigvidd/mock/image.jpg",
                        TrailId = 4
                    }
                }
            },
            new Trail
            {
                Id = 5,
                Identifier = "55e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a",
                Name = "Gesebol",
                TrailLength = 6.0M,
                Classification = 1,
                Accessibility = false,
                AccessibilityInfo = "Asfalt, stig och grusväg",
                Description = "En lättvandrad slinga som kombinerar skogsstigar, grusväg och kortare asfaltspartier.",
                FullDescription = string.Empty,
                TrailSymbol = "Röd markering med en 6:a på",
                TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
                Coordinates = coordinates,
                Tags = tags,
                IsVerified = true,
                City = "Gesebol",
                CreatedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow
            },
            new Trail
            {
                Id = 6,
                Identifier = "66f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b",
                Name = "Hultafors",
                TrailLength = 4.5M,
                Classification = 2,
                Accessibility = false,
                AccessibilityInfo = "Asfalt, stigar och grusväg",
                Description = "En medelsvår led med både skogsstigar, grusvägar och öppnare partier.",
                FullDescription = string.Empty,
                TrailSymbol = "Blå markering",
                TrailSymbolImage = "https://inkaben.se/stigvidd/mock/mock-trail-symbol.png",
                Coordinates = coordinates,
                Tags = tags,
                IsVerified = true,
                City = "Hultafors",
                CreatedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow
            },
            new Trail
            {
                Id = 7,
                Identifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c",
                Name = "Nässehult",
                TrailLength = 4.5M,
                Classification = 1,
                Accessibility = true,
                AccessibilityInfo = "Asfalt och grusväg",
                Description = "En lätt och tillgänglig led på asfalt och grusväg som passar för alla.",
                FullDescription = string.Empty,
                TrailSymbol = "Nässla",
                TrailSymbolImage = "https://inkaben.se/stigvidd/mock/nassla.png",
                Coordinates = coordinates,
                Tags = tags,
                IsVerified= true,
                City = "Nässehult",
                CreatedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow,
                TrailImages = new List<TrailImage>
                {
                    new TrailImage
                    {
                        Id = 8,
                        Identifier = "img-nassehult-1",
                        ImageUrl = "https://inkaben.se/stigvidd/mock/image.jpg",
                        TrailId = 7
                    },
                    new TrailImage
                    {
                        Id = 9,
                        Identifier = "img-nassehult-2",
                        ImageUrl = "https://inkaben.se/stigvidd/mock/image.jpg",
                        TrailId = 7
                    }
                }
            }
        ];
    }

    public static List<User> GetSeedingUsers(List<Trail> trails)
    {
        return new List<User>
        {
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
                    trails.First(t => t.Id == 4),
                    trails.First(t => t.Id == 7)
                }
            },
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

    public static List<HikeShare> GetSeedingHikeShares()
    {
        return new List<HikeShare>
        {
            new HikeShare { HikeId = 1, SharedWithId = 2, SharedById = 1, CreatedAt = SeedDates.Created },
            new HikeShare { HikeId = 2, SharedWithId = 3, SharedById = 1, CreatedAt = SeedDates.Created },
            new HikeShare { HikeId = 3, SharedWithId = 1, SharedById = 2, CreatedAt = SeedDates.Created },
            new HikeShare { HikeId = 4, SharedWithId = 4, SharedById = 2, CreatedAt = SeedDates.Created },
            new HikeShare { HikeId = 5, SharedWithId = 5, SharedById = 3, CreatedAt = SeedDates.Created }
        };
    }

    public static List<FriendRequest> GetSeedingFriendRequests()
    {
        return new List<FriendRequest>
        {
            new FriendRequest { RequesterId = 1, ReceiverId = 2, Status = FriendRequestStatus.Accepted, CreatedAt = SeedDates.Created },
            new FriendRequest { RequesterId = 1, ReceiverId = 3, Status = FriendRequestStatus.Pending, CreatedAt = SeedDates.Created },
            new FriendRequest { RequesterId = 2, ReceiverId = 3, Status = FriendRequestStatus.Pending, CreatedAt = SeedDates.Created },
            new FriendRequest { RequesterId = 3, ReceiverId = 4, Status = FriendRequestStatus.Accepted, CreatedAt = SeedDates.Created },
            new FriendRequest { RequesterId = 4, ReceiverId = 5, Status = FriendRequestStatus.Pending, CreatedAt = SeedDates.Created }
        };
    }

    public static List<Review> GetSeedingReviews(List<Trail> trails, List<User> users)
    {
        return new List<Review>
        {
            new Review
            {
                Id = 1,
                Identifier = "r1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
                TrailReview = "Fantastisk led! Utmanande terräng men väl värd ansträngningen. Otroliga vyer från klipporna.",
                Rating = 4.5M,
                TrailId = 1,
                UserId = 2,
                CreatedAt = SeedDates.Created,
                LastUpdatedAt = SeedDates.Updated,
                ReviewImages = new List<ReviewImage>
                {
                    new ReviewImage { Id = 1, Identifier = "rev-img-1", ImageUrl = "https://inkaben.se/stigvidd/mock/review-tiveden-1.jpg", ReviewId = 1 },
                    new ReviewImage { Id = 2, Identifier = "rev-img-2", ImageUrl = "https://inkaben.se/stigvidd/mock/review-tiveden-2.jpg", ReviewId = 1 }
                }
            },
            new Review
            {
                Id = 2,
                Identifier = "r2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
                TrailReview = "Fin led, lite hal i vissa partier.",
                Rating = 3.5M,
                TrailId = 2,
                UserId = 1,
                CreatedAt = SeedDates.Created,
                LastUpdatedAt = SeedDates.Updated
            },
            new Review
            {
                Id = 3,
                Identifier = "r3c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
                TrailReview = "Perfekt för en avkopplande söndagspromenad. Väl markerad och lättgången.",
                Rating = 5.0M,
                TrailId = 7,
                UserId = 6,
                CreatedAt = SeedDates.Created,
                LastUpdatedAt = SeedDates.Updated
            },
            new Review
            {
                Id = 4,
                Identifier = "r4d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
                TrailReview = "Bra blandning av terräng. Skulle önska bättre skyltning vid några korsningar.",
                Rating = 3.0M,
                TrailId = 3,
                UserId = 3,
                CreatedAt = SeedDates.Created,
                LastUpdatedAt = SeedDates.Updated
            },
            new Review
            {
                Id = 5,
                Identifier = "r5e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a",
                TrailReview = null,
                Rating = 4.0M,
                TrailId = 4,
                UserId = 5,
                CreatedAt = SeedDates.Created,
                LastUpdatedAt = SeedDates.Updated
            },
            new Review
            {
                Id = 6,
                Identifier = "r6f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b",
                TrailReview = "Mysig led genom vacker natur. Tog med barnen och de älskade det!",
                Rating = 4.5M,
                TrailId = 7,
                UserId = 1,
                CreatedAt = SeedDates.Created,
                LastUpdatedAt = SeedDates.Updated
            },
            new Review
            {
                Id = 7,
                Identifier = "r7a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c",
                TrailReview = "Leden är okej men lite för mycket grus och asfalt för min smak. Saknar mer naturstigar.",
                Rating = 2.5M,
                TrailId = 5,
                UserId = 4,
                CreatedAt = SeedDates.Created,
                LastUpdatedAt = SeedDates.Updated
            },
            new Review
            {
                Id = 8,
                Identifier = "r8b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d",
                TrailReview = "Underbar upplevelse! Såg både älg och rådjur. Rekommenderar starkt!",
                Rating = 5.0M,
                TrailId = 1,
                UserId = 3,
                CreatedAt = SeedDates.Created,
                LastUpdatedAt = SeedDates.Updated,
                ReviewImages = new List<ReviewImage>
                {
                    new ReviewImage { Id = 3, Identifier = "rev-img-3", ImageUrl = "https://inkaben.se/stigvidd/mock/review-wildlife.jpg", ReviewId = 8 }
                }
            }
        };
    }

    public static List<Hike> GetSeedingHikes(List<User> users)
    {
        return
        [
            new Hike { Id = 1, Identifier = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90", Name = "TestHike1", HikeLength = 10, Duration = 3600000, Coordinates = string.Empty, CreatedBy = users[0].Identifier, UserId= users[0].Id },
            new Hike { Id = 2, Identifier = "b7a2d4c1-5e9f-4a63-8c1d-0f2e7b9a6c34", Name = "TestHike2", HikeLength = 20, Duration = 7200000, Coordinates = string.Empty, CreatedBy = users[0].Identifier, UserId= users[0].Id },
            new Hike { Id = 3, Identifier = "91e4c2d7-3b8f-4f6a-9d1c-7a2e5b0c8f13", Name = "TestHike3", HikeLength = 30, Duration = 10800000, Coordinates = string.Empty, CreatedBy = users[1].Identifier, UserId= users[1].Id },
            new Hike { Id = 4, Identifier = "c4d8a1b9-6f3e-4c72-8a5d-1e9b2f7c0a46", Name = "TestHike4", HikeLength = 40, Duration = 14400000, Coordinates = string.Empty, CreatedBy = users[1].Identifier, UserId= users[1].Id },
            new Hike { Id = 5, Identifier = "7a1e9c3d-2b4f-4d68-8c0a-5f2b7e1d9c32", Name = "TestHike5", HikeLength = 50, Duration = 18000000, Coordinates = string.Empty, CreatedBy = users[2].Identifier, UserId= users[2].Id },
            new Hike { Id = 6, Identifier = "a2f3b1c4-9e7d-4a21-bc5f-3d8e6f1a2b90", Name = "TestHike6", HikeLength = 15, Duration = 5400000, Coordinates = string.Empty, CreatedBy = users[4].Identifier, UserId= users[4].Id }
        ];
    }

    public static List<TrailObstacle> GetSeedingTrailObstacles(List<Trail> trails, List<User> users)
    {
        return
        [
            new TrailObstacle
            {
                Id = 1,
                Identifier = "ob1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
                Description = "Stort träd har fallit över stigen och blockerar passage.",
                IssueType = TrailIssueType.FallenTree,
                TrailId = 1,
                UserId = 1,
                IncidentLongitude = 14.5M,
                IncidentLatitude = 58.9M,
                CreatedAt = DateTime.UtcNow.AddDays(-5),
                LastUpdatedAt = DateTime.UtcNow.AddDays(-5),
            },
            new TrailObstacle
            {
                Id = 2,
                Identifier = "ob2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
                Description = "Översvämning vid bron, svårt att passera.",
                IssueType = TrailIssueType.Flooding,
                TrailId = 2,
                UserId = 2,
                CreatedAt = DateTime.UtcNow.AddDays(-10),
                LastUpdatedAt = DateTime.UtcNow.AddDays(-10),
            },
            new TrailObstacle
            {
                Id = 3,
                Identifier = "ob3c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
                Description = "Lera och blöt mark efter regn, svårt att ta sig fram.",
                IssueType = TrailIssueType.Mud,
                TrailId = 3,
                UserId = 3,
                CreatedAt = DateTime.UtcNow.AddDays(-2),
                LastUpdatedAt = DateTime.UtcNow.AddDays(-2),
            },
            new TrailObstacle
            {
                Id = 4,
                Identifier = "ob4d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
                Description = "Gammal nedfallen skylt som blockerade stigen.",
                IssueType = TrailIssueType.Signage,
                TrailId = 1,
                UserId = 4,
                CreatedAt = DateTime.UtcNow.AddDays(-40),
                LastUpdatedAt = DateTime.UtcNow.AddDays(-40),
            },
        ];
    }

    public static List<TrailObstacleSolvedVote> GetSeedingTrailObstacleSolvedVotes(List<TrailObstacle> obstacles, List<User> users)
    {
        return
        [
            new TrailObstacleSolvedVote { Id = 1, Identifier = "sv1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c", TrailObstacleId = 2, UserId = 1, CreatedAt = SeedDates.Created, LastUpdatedAt = SeedDates.Updated },
            new TrailObstacleSolvedVote { Id = 2, Identifier = "sv2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", TrailObstacleId = 3, UserId = 1, CreatedAt = SeedDates.Created, LastUpdatedAt = SeedDates.Updated },
            new TrailObstacleSolvedVote { Id = 3, Identifier = "sv3c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", TrailObstacleId = 3, UserId = 2, CreatedAt = SeedDates.Created, LastUpdatedAt = SeedDates.Updated },
            new TrailObstacleSolvedVote { Id = 4, Identifier = "sv4d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f", TrailObstacleId = 3, UserId = 3, CreatedAt = SeedDates.Created, LastUpdatedAt = SeedDates.Updated },
        ];
    }

    public static List<Facility> GetSeedingFacilities()
    {
        return
        [
            new Facility
            {
                Id = 1,
                Identifier = "fac1a1b2-c3d4-4e5f-6a7b-8c9d0e1f2a3b",
                Name = "Grillplats Tiveden",
                FacilityType = FacilityType.FirePit,
                IsAccessible = true,
                Latitude = 58.9M,
                Longitude = 14.5M,
                CreatedAt = SeedDates.Created,
                LastUpdatedAt = SeedDates.Updated
            },
            new Facility
            {
                Id = 2,
                Identifier = "fac2b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
                Name = "Vindskydd Gesebol",
                FacilityType = FacilityType.Shelter,
                IsAccessible = false,
                Latitude = 58.1M,
                Longitude = 13.9M,
                CreatedAt = SeedDates.Created,
                LastUpdatedAt = SeedDates.Updated
            },
        ];
    }

    public static class Identifiers
    {
        public const string User = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
        public const string UserWithNoFavorites = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a33";
        public const string UserWithNoWishlist = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a44";
        public const string UserFirebaseUid = "firebase-uid-12345";
        public const string Trail1 = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
        public const string Trail4 = "44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f";
        public const string Trail7 = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c";
        public const string Hike1 = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90";
        public const string Review5 = "r5e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a";
        public const string Obstacle1 = "ob1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
        public const string Facility1 = "fac1a1b2-c3d4-4e5f-6a7b-8c9d0e1f2a3b";
        public const string Facility2 = "fac2b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
    }

    public static class Stubs
    {
        public static Hike Hike() => new()
        {
            Id = 1,
            Identifier = Identifiers.Hike1,
            Name = "TestHike1",
            HikeLength = 10,
            Duration = 3600000,
            Coordinates = "[]",
            CreatedBy = Identifiers.User,
            UserId = 1
        };

        public static Review Review(bool withImages = false) => new()
        {
            Id = 1,
            Identifier = Identifiers.Review5,
            TrailReview = "Great trail",
            Rating = 4.0M,
            User = new User { Id = 1, Identifier = Identifiers.User, NickName = "Nick", Email = "nick@test.com", FirebaseUid = "uid" },
            Trail = new Trail { Id = 7, Identifier = Identifiers.Trail7, Name = "Nässehult", TrailLength = 5M },
            CreatedAt = DateTime.UtcNow,
            ReviewImages = withImages
                ? [new ReviewImage { Id = 1, Identifier = "img-1", ImageUrl = "reviews/img.jpg" }]
                : []
        };

        public static TrailObstacle Obstacle(List<TrailObstacleSolvedVote>? votes = null) => new()
        {
            Id = 1,
            Identifier = Identifiers.Obstacle1,
            Description = "Fallen tree",
            IssueType = TrailIssueType.FallenTree,
            TrailId = 1,
            UserId = 1,
            User = new User { Id = 1, Identifier = Identifiers.User, NickName = "Nick", Email = "nick@test.com", FirebaseUid = "uid" },
            SolvedVotes = votes ?? []
        };

        public static TrailObstacleSolvedVote Vote() => new()
        {
            Id = 1,
            Identifier = "vote-1",
            TrailObstacleId = 1,
            UserId = 1,
            User = new User { Id = 1, Identifier = Identifiers.User, NickName = "Nick", Email = "nick@test.com", FirebaseUid = "uid" }
        };

        public static UserResponseModel UserResponse() =>
            UserResponseModel.Create(Identifiers.User, "Nick", "nick@test.com", null, null);

        public static IFormFile FakeFile(string name = "test.jpg")
        {
            var bytes = Encoding.UTF8.GetBytes("fake image content");
            return new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", name)
            {
                Headers = new HeaderDictionary(),
                ContentType = "image/jpeg"
            };
        }

        public static FormFileCollection TwoImages()
        {
            var col = new FormFileCollection();
            col.Add(FakeFile("img1.jpg"));
            col.Add(FakeFile("img2.jpg"));
            return col;
        }
    }

    public static class MockFactory
    {
        public static Mock<IUserService> UserServiceFoundById(int id = 1)
        {
            var mock = new Mock<IUserService>();
            mock.Setup(u => u.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Result.Ok(id));
            return mock;
        }

        public static Mock<IUserService> UserServiceNotFoundById()
        {
            var mock = new Mock<IUserService>();
            mock.Setup(u => u.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Result.Fail<int>(new Message(404, "User not found")));
            return mock;
        }

        public static Mock<ITrailService> TrailServiceFound(int id = 1)
        {
            var mock = new Mock<ITrailService>();
            mock.Setup(t => t.GetTrailIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Result.Ok(id));
            return mock;
        }

        public static Mock<ITrailService> TrailServiceNotFound()
        {
            var mock = new Mock<ITrailService>();
            mock.Setup(t => t.GetTrailIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Result.Fail<int>(new Message(404, "Trail not found")));
            return mock;
        }

        public static Mock<IWebDavService> WebDavService()
        {
            var mock = new Mock<IWebDavService>();
            mock.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
                .ReturnsAsync(Result.Ok<string?>("uploads/test-image.jpg"));
            mock.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
                .ReturnsAsync(Result.Ok(true));
            return mock;
        }

        public static Mock<IUserRepository> UserRepositoryFoundByIdentifier()
        {
            var user = new User { Id = 1, Identifier = Identifiers.User, NickName = "Nick", Email = "nick@test.com", FirebaseUid = "uid" };
            var mock = new Mock<IUserRepository>();
            mock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, User>>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(RepositoryResult<User>.Success(user));
            return mock;
        }
    }
}
