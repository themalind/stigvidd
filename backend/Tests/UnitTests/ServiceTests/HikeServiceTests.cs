// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using AwesomeAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using System.Linq.Expressions;
using WebDataContracts.RequestModels.Hike;
using WebDataContracts.ResponseModels.Hike;

namespace UnitTests.ServiceTests;

public class HikeServiceTests
{
    private HikeService Build(
        Mock<IHikeRepository>? hikeRepo = null,
        Mock<IUserRepository>? userRepo = null,
        Mock<IHikeShareRecipientRepository>? shareRepo = null,
        Mock<IWebDavService>? webDav = null) =>
        new(
            (hikeRepo ?? new Mock<IHikeRepository>()).Object,
            new HikeResponseFactory(),
            (userRepo ?? new Mock<IUserRepository>()).Object,
            (shareRepo ?? new Mock<IHikeShareRecipientRepository>()).Object,
            (webDav ?? Utilities.MockFactory.WebDavService()).Object,
            NullLogger<HikeService>.Instance);

    private static CreateHikeRequest ValidRequest() => new()
    {
        Name = "TestHike",
        HikeLength = 5000,
        Duration = 1800000,
        Coordinates = "[{\"latitude\":57.62,\"longitude\":12.81},{\"latitude\":57.64,\"longitude\":12.83}]",
        Description = "Description",
        GettingThere = "Getting there",
        ParkingInfo = "Parking info"
    };

    [Fact]
    public async Task CreateHike_WhenUserExists_ReturnsSuccess()
    {
        // Arrange
        Hike? saved = null;
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.CreateHikeAsync(It.IsAny<Hike>(), It.IsAny<CancellationToken>()))
            .Callback<Hike, CancellationToken>((h, _) => saved = h)
            .ReturnsAsync(RepositoryResult<Hike>.Success(Utilities.Stubs.Hike()));

        // Act
        var result = await Build(hikeRepo, UserExistsRepo()).CreateHikeAsync(ValidRequest(), Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();

        // The creator's nickname is copied onto the hike at creation so the recipient view
        // can still name the author after the owner's user row is gone.
        saved.Should().NotBeNull();
        saved!.CreatedBy.Should().Be(Utilities.Identifiers.User);
        saved.CreatedByNickName.Should().Be("TestUser");
        // The path is persisted, so it has to carry the schema's SRID, not the NTS default of 0.
        saved.GeoPath.SRID.Should().Be(GeoPointFactory.Wgs84Srid);
    }

    [Fact]
    public async Task CreateHike_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserByIdentifierAsync(
                It.IsAny<string>(),
                It.IsAny<Expression<Func<User, UserProjection>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserProjection>.NotFound());

        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.CreateHikeAsync(It.IsAny<Hike>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(Utilities.Stubs.Hike()));

        var service = Build(userRepo: userRepo, hikeRepo: hikeRepo);

        // Act
        var result = await service.CreateHikeAsync(ValidRequest(), "unknown", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    // Name/HikeLength/Duration validation lives in CreateHikeRequestValidator (see
    // CreateHikeRequestValidatorTests) and is enforced by auto-validation before the
    // service runs. The service is only responsible for parsing/bounding coordinates.

    private static Mock<IUserRepository> UserExistsRepo()
    {
        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserByIdentifierAsync(
                Utilities.Identifiers.User,
                It.IsAny<Expression<Func<User, UserProjection>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserProjection>.Success(new UserProjection(1, "TestUser")));
        return userRepo;
    }

    [Fact]
    public async Task CreateHike_WithMalformedCoordinatesJson_ReturnsBadRequest()
    {
        // Arrange — a malformed blob must not bubble up as an unhandled 500.
        var request = new CreateHikeRequest { Name = "Hike", HikeLength = 5000, Duration = 1800000, Coordinates = "{not valid json" };

        // Act
        var result = await Build(userRepo: UserExistsRepo()).CreateHikeAsync(request, Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task CreateHike_WithFewerThanTwoCoordinates_ReturnsBadRequest()
    {
        // Arrange
        var request = new CreateHikeRequest { Name = "Hike", HikeLength = 5000, Duration = 1800000, Coordinates = "[{\"latitude\":57.6,\"longitude\":12.8}]" };

        // Act
        var result = await Build(userRepo: UserExistsRepo()).CreateHikeAsync(request, Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task CreateHike_WithTooManyCoordinates_ReturnsBadRequest()
    {
        // Arrange — build an array well past the 20,000-point cap.
        var points = Enumerable.Repeat("{\"latitude\":57.6,\"longitude\":12.8}", 20_001);
        var request = new CreateHikeRequest
        {
            Name = "Hike",
            HikeLength = 5000,
            Duration = 1800000,
            Coordinates = "[" + string.Join(",", points) + "]"
        };

        // Act
        var result = await Build(userRepo: UserExistsRepo()).CreateHikeAsync(request, Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }

    [Theory]
    [InlineData("[{\"latitude\":91,\"longitude\":12.8},{\"latitude\":57.6,\"longitude\":12.8}]")]   // lat > 90
    [InlineData("[{\"latitude\":-91,\"longitude\":12.8},{\"latitude\":57.6,\"longitude\":12.8}]")]  // lat < -90
    [InlineData("[{\"latitude\":57.6,\"longitude\":181},{\"latitude\":57.6,\"longitude\":12.8}]")]  // lng > 180
    [InlineData("[{\"latitude\":57.6,\"longitude\":-181},{\"latitude\":57.6,\"longitude\":12.8}]")] // lng < -180
    public async Task CreateHike_WithOutOfRangeCoordinates_ReturnsBadRequest(string coordinates)
    {
        // Arrange — neither the geometry column nor NetTopologySuite rejects points
        // outside WGS84 bounds, so the service must guard against them.
        var request = new CreateHikeRequest { Name = "Hike", HikeLength = 5000, Duration = 1800000, Coordinates = coordinates };

        // Act
        var result = await Build(userRepo: UserExistsRepo()).CreateHikeAsync(request, Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task CreateHike_WhenRepositoryFails_ReturnsInternalServerError()
    {
        // Arrange
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.CreateHikeAsync(It.IsAny<Hike>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Error());

        // Act
        var result = await Build(userRepo: UserExistsRepo(), hikeRepo: hikeRepo).CreateHikeAsync(ValidRequest(), Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetHikeByIdentifier_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(Utilities.Stubs.Hike()));

        // Act
        var result = await Build(hikeRepo).GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Identifier.Should().Be(Utilities.Identifiers.Hike1);
        result.Value.Name.Should().Be("TestHike1");
    }

    [Fact]
    public async Task GetHikeByIdentifier_WhenNotOwnerAndNotSharedWith_ReturnsForbidden()
    {
        // Arrange
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(Utilities.Stubs.Hike()));

        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserIdByIdentifierAsync("some-other-user", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(99));

        var shareRepo = new Mock<IHikeShareRecipientRepository>();
        shareRepo.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));

        // Act — a different user with no share requests someone else's private hike
        var result = await Build(hikeRepo, userRepo, shareRepo).GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, "some-other-user", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task GetHikeByIdentifier_WhenUserRepositoryErrors_ReturnsInternalServerError()
    {
        // Arrange — the access check cannot run, so the answer must not sound like one
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(Utilities.Stubs.Hike()));

        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserIdByIdentifierAsync("some-other-user", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        // Act
        var result = await Build(hikeRepo, userRepo).GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, "some-other-user", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetHikeByIdentifier_WhenShareRepositoryErrors_ReturnsInternalServerError()
    {
        // Arrange — the user is known, but the share lookup fails
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(Utilities.Stubs.Hike()));

        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserIdByIdentifierAsync("recipient", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(99));

        var shareRepo = new Mock<IHikeShareRecipientRepository>();
        shareRepo.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Error());

        // Act
        var result = await Build(hikeRepo, userRepo, shareRepo).GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, "recipient", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetHikeByIdentifier_WhenRequesterHasNoUserRow_ReturnsForbidden()
    {
        // Arrange — authenticated but unknown here: no share can point at them, so 403 stands
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(Utilities.Stubs.Hike()));

        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserIdByIdentifierAsync("stranger", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        // Act
        var result = await Build(hikeRepo, userRepo).GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, "stranger", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task GetHikeByIdentifier_WhenSharedWithUser_ReturnsSuccess()
    {
        // Arrange
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(Utilities.Stubs.Hike()));

        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserIdByIdentifierAsync("recipient", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(99));

        var shareRepo = new Mock<IHikeShareRecipientRepository>();
        shareRepo.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        // Act — a recipient of a shared hike may read it
        var result = await Build(hikeRepo, userRepo, shareRepo).GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, "recipient", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task GetHikeByIdentifier_WhenFound_MapsExtraFields()
    {
        // Arrange
        var hike = new Hike
        {
            Id = 1,
            Identifier = Utilities.Identifiers.Hike1,
            Name = "TestHike1",
            HikeLength = 10,
            Duration = 3600000,
            GeoPath = Utilities.GeoPath(),
            CreatedBy = Utilities.Identifiers.User,
            UserId = 1,
            GettingThere = "Take bus 42",
            ParkingInfo = "Parking at the church",
            Description = "Scenic route through the forest",
            CreatedByNickName = "HikerJoe",
        };

        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));

        // Act
        var result = await Build(hikeRepo).GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.GettingThere.Should().Be("Take bus 42");
        result.Value.ParkingInfo.Should().Be("Parking at the church");
        result.Value.Description.Should().Be("Scenic route through the forest");
    }

    [Fact]
    public async Task GetHikeByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.NotFound());

        // Act
        var result = await Build(hikeRepo).GetHikeByIdentifierAsync("no-such-hike", Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetHikes_WhenCreatorExists_ReturnsTheirHikes()
    {
        // Arrange
        var createdAtDate = DateTime.UtcNow;
        IReadOnlyCollection<HikeOverviewResponse> list =
        [
            HikeOverviewResponse.Create("id1", "H1", 10, 3600000, "[]", Utilities.Identifiers.User, null, null, null, createdAtDate),
            HikeOverviewResponse.Create("id2", "H2", 20, 7200000, "[]", Utilities.Identifiers.User, null, null, null, createdAtDate),
        ];
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikesAsync(It.IsAny<int?>(), It.IsAny<Expression<Func<Hike, HikeOverviewResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<HikeOverviewResponse>>.Success(list));

        // Act
        var result = await Build(hikeRepo, Utilities.MockFactory.UserRepositoryFoundById(7)).GetHikesAsync(Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetHikes_AlwaysScopesTheQueryToTheCreator()
    {
        // Arrange — the repository reads every hike in the database when userId is null,
        // so the resolved id must reach it. Hikes are private; there is no "list them all".
        int? passedUserId = null;
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikesAsync(It.IsAny<int?>(), It.IsAny<Expression<Func<Hike, HikeOverviewResponse>>>(), It.IsAny<CancellationToken>()))
            .Callback<int?, Expression<Func<Hike, HikeOverviewResponse>>, CancellationToken>((id, _, _) => passedUserId = id)
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<HikeOverviewResponse>>.Success([]));

        // Act
        var result = await Build(hikeRepo, Utilities.MockFactory.UserRepositoryFoundById(7)).GetHikesAsync(Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        passedUserId.Should().Be(7);
    }

    [Fact]
    public async Task GetHikes_WhenCreatorNotFound_ReturnsNotFound()
    {
        // Arrange — an empty list would claim the account exists and owns nothing
        var hikeRepo = new Mock<IHikeRepository>();

        // Act
        var result = await Build(hikeRepo, Utilities.MockFactory.UserRepositoryNotFoundById()).GetHikesAsync("gone-user", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        hikeRepo.Verify(r => r.GetHikesAsync(It.IsAny<int?>(), It.IsAny<Expression<Func<Hike, HikeOverviewResponse>>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetHikes_WhenUserRepositoryErrors_ReturnsInternalServerError()
    {
        // Arrange
        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        // Act
        var result = await Build(userRepo: userRepo).GetHikesAsync(Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetHikes_WhenRepositoryFails_ReturnsInternalServerError()
    {
        // Arrange
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikesAsync(It.IsAny<int?>(), It.IsAny<Expression<Func<Hike, HikeOverviewResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<HikeOverviewResponse>>.Error());

        // Act
        var result = await Build(hikeRepo, Utilities.MockFactory.UserRepositoryFoundById()).GetHikesAsync(Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task UpdateHike_WhenOwner_ReturnsSuccess()
    {
        // Arrange
        var hike = Utilities.Stubs.Hike();
        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, int>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));
        hikeRepo.Setup(r => r.UpdateHikeAsync(It.IsAny<Hike>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));

        // Act
        var result = await Build(hikeRepo, userRepo).UpdateHikeAsync(
            Utilities.Identifiers.Hike1, Utilities.Identifiers.User,
            "NewName", "NewDesc", null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.Name.Should().Be("NewName");
        result.Value.Description.Should().Be("NewDesc");
    }

    [Fact]
    public async Task UpdateHike_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, int>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        // Act
        var result = await Build(userRepo: userRepo).UpdateHikeAsync(
            Utilities.Identifiers.Hike1, "unknown-user",
            "NewName", null, null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task UpdateHike_WhenUserRepositoryErrors_ReturnsInternalServerError()
    {
        // Arrange — a failed lookup must not be reported as a missing user
        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, int>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        // Act
        var result = await Build(userRepo: userRepo).UpdateHikeAsync(
            Utilities.Identifiers.Hike1, Utilities.Identifiers.User,
            "NewName", null, null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task UpdateHike_WhenHikeNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, int>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.NotFound());

        // Act
        var result = await Build(hikeRepo, userRepo).UpdateHikeAsync(
            "no-such-hike", Utilities.Identifiers.User,
            "NewName", null, null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task UpdateHike_WhenHikeRepositoryErrors_ReturnsInternalServerError()
    {
        // Arrange
        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, int>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Error());

        // Act
        var result = await Build(hikeRepo, userRepo).UpdateHikeAsync(
            Utilities.Identifiers.Hike1, Utilities.Identifiers.User,
            "NewName", null, null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task UpdateHike_WhenNotOwner_ReturnsForbidden()
    {
        // Arrange
        var hike = Utilities.Stubs.Hike(); // UserId = 1
        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, int>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(99)); // different user
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));

        // Act
        var result = await Build(hikeRepo, userRepo).UpdateHikeAsync(
            Utilities.Identifiers.Hike1, "other-user",
            "NewName", null, null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task DeleteHike_WhenOwner_ReturnsSuccess()
    {
        // Arrange
        var hike = Utilities.Stubs.Hike();
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));
        hikeRepo.Setup(r => r.DeleteHikeAsync(hike, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        hikeRepo.Setup(r => r.HikeHasSharesAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));
        hikeRepo.Setup(r => r.GetHikeImageUrlsByHikeIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<string>>.Success([]));

        // Act
        var result = await Build(hikeRepo, Utilities.MockFactory.UserRepositoryFoundByIdentifier()).DeleteHikeAsync(Utilities.Identifiers.Hike1, Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteHike_WhenUserRepositoryErrors_ReturnsInternalServerError()
    {
        // Arrange — a failed lookup must not be reported as a missing user
        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, User>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<User>.Error());

        // Act
        var result = await Build(userRepo: userRepo).DeleteHikeAsync(Utilities.Identifiers.Hike1, Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task DeleteHike_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.NotFound());

        // Act
        var result = await Build(hikeRepo, Utilities.MockFactory.UserRepositoryFoundByIdentifier()).DeleteHikeAsync("no-such", Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteHike_WhenNotOwner_ReturnsForbidden()
    {
        // Arrange
        var hike = Utilities.Stubs.Hike();
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));

        var userRepo = new Mock<IUserRepository>();
        var otherUser = new User { Id = 2, Identifier = "other-user", NickName = "Other", Email = "other@test.com", SubjectId = "uid2" };
        userRepo.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, User>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<User>.Success(otherUser));

        // Act
        var result = await Build(hikeRepo, userRepo).DeleteHikeAsync(Utilities.Identifiers.Hike1, "other-user", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task DeleteHike_WhenHikeIsShared_LeavesTheImageFilesAlone()
    {
        // Arrange — a shared hike is kept for its recipients, so its files must survive with it
        var hike = Utilities.Stubs.Hike();
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));
        hikeRepo.Setup(r => r.HikeHasSharesAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));
        hikeRepo.Setup(r => r.DeleteHikeAsync(hike, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var webDav = Utilities.MockFactory.WebDavService();

        // Act
        var result = await Build(hikeRepo, Utilities.MockFactory.UserRepositoryFoundByIdentifier(), webDav: webDav)
            .DeleteHikeAsync(Utilities.Identifiers.Hike1, Utilities.Identifiers.User, CancellationToken.None);

        // Assert — the URLs are never even fetched for a hike that is not going away
        result.Success.Should().BeTrue();
        hikeRepo.Verify(r => r.GetHikeImageUrlsByHikeIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
        webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task DeleteHike_WhenRowDeleteFails_ReturnsInternalServerErrorAndKeepsTheFiles()
    {
        // Arrange
        var hike = Utilities.Stubs.Hike();
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));
        hikeRepo.Setup(r => r.HikeHasSharesAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));
        hikeRepo.Setup(r => r.GetHikeImageUrlsByHikeIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<string>>.Success(["hikes/a.jpeg"]));
        hikeRepo.Setup(r => r.DeleteHikeAsync(hike, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var webDav = Utilities.MockFactory.WebDavService();

        // Act
        var result = await Build(hikeRepo, Utilities.MockFactory.UserRepositoryFoundByIdentifier(), webDav: webDav)
            .DeleteHikeAsync(Utilities.Identifiers.Hike1, Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
        webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task DeleteHike_WhenWebDavThrows_StillSucceeds()
    {
        // Arrange — the row is already gone, so a failed file delete must not be reported as failure
        var hike = Utilities.Stubs.Hike();
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));
        hikeRepo.Setup(r => r.HikeHasSharesAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));
        hikeRepo.Setup(r => r.GetHikeImageUrlsByHikeIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<string>>.Success(["hikes/a.jpeg", "hikes/b.jpeg"]));
        hikeRepo.Setup(r => r.DeleteHikeAsync(hike, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ThrowsAsync(new Exception("webdav down"));

        // Act
        var result = await Build(hikeRepo, Utilities.MockFactory.UserRepositoryFoundByIdentifier(), webDav: webDav)
            .DeleteHikeAsync(Utilities.Identifiers.Hike1, Utilities.Identifiers.User, CancellationToken.None);

        // Assert — the first failure did not stop the second file from being attempted
        result.Success.Should().BeTrue();
        webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Exactly(2));
    }

    [Fact]
    public async Task CleanUpOrphanedHikes_DeletesTheImageFilesAfterTheRows()
    {
        // Arrange
        var callOrder = new List<string>();
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetOrphanedHikeImageUrlsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<string>>.Success(["hikes/a.jpeg"]));
        hikeRepo.Setup(r => r.DeleteOrphanedHikesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success())
            .Callback(() => callOrder.Add("rows"));

        var webDav = Utilities.MockFactory.WebDavService();
        webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ReturnsAsync(Result.Ok(true))
            .Callback<string>(url => callOrder.Add(url));

        // Act
        await Build(hikeRepo, webDav: webDav).CleanUpOrphanedHikesAsync(CancellationToken.None);

        // Assert
        callOrder.Should().Equal("rows", "hikes/a.jpeg");
    }

    [Fact]
    public async Task CleanUpOrphanedHikes_WhenRowDeleteFails_DoesNotTouchWebDav()
    {
        // Arrange — the rows are still there, so their files must stay too
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetOrphanedHikeImageUrlsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<string>>.Success(["hikes/a.jpeg"]));
        hikeRepo.Setup(r => r.DeleteOrphanedHikesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var webDav = Utilities.MockFactory.WebDavService();

        // Act
        await Build(hikeRepo, webDav: webDav).CleanUpOrphanedHikesAsync(CancellationToken.None);

        // Assert
        webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task DeleteHikeSharesByUserId_SweepsOrphanedHikes()
    {
        // Arrange — a recipient deleting their account can leave the last ownerless hike behind
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.DeleteHikeSharesByUserIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        hikeRepo.Setup(r => r.GetOrphanedHikeImageUrlsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<string>>.Success([]));
        hikeRepo.Setup(r => r.DeleteOrphanedHikesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(hikeRepo).DeleteHikeSharesByUserIdAsync(1, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        hikeRepo.Verify(r => r.DeleteOrphanedHikesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteHikeSharesByUserId_WhenSweepFails_StillSucceeds()
    {
        // Arrange — the shares are gone, so the caller's request succeeded; a leftover row is
        // housekeeping the next sweep will pick up
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.DeleteHikeSharesByUserIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        hikeRepo.Setup(r => r.GetOrphanedHikeImageUrlsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<string>>.Error());

        // Act
        var result = await Build(hikeRepo).DeleteHikeSharesByUserIdAsync(1, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task HandleUserHikesOnUserDelete_DeletesTheImageFilesAfterTheRows()
    {
        // Arrange
        var callOrder = new List<string>();
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetDeletableHikeImageUrlsByUserIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<string>>.Success(["hikes/a.jpeg", "hikes/b.jpeg"]));
        hikeRepo.Setup(r => r.HandleUserHikesOnUserDeleteAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success())
            .Callback(() => callOrder.Add("rows"));
        hikeRepo.Setup(r => r.AnonymizeSharedHikesOnUserDeleteAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success())
            .Callback(() => callOrder.Add("anonymize"));

        var webDav = Utilities.MockFactory.WebDavService();
        webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ReturnsAsync(Result.Ok(true))
            .Callback<string>(url => callOrder.Add(url));

        // Act
        var result = await Build(hikeRepo, webDav: webDav).HandleUserHikesOnUserDeleteAsync(1, CancellationToken.None);

        // Assert — the anonymisation runs on what the delete left behind, and files come last
        result.Success.Should().BeTrue();
        callOrder.Should().Equal("rows", "anonymize", "hikes/a.jpeg", "hikes/b.jpeg");
    }

    [Fact]
    public async Task HandleUserHikesOnUserDelete_WhenAnonymizeFails_ReturnsInternalServerError()
    {
        // Arrange — the creator's identifiers would survive on the shared hikes, so this
        // must not pass silently
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetDeletableHikeImageUrlsByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<string>>.Success(["hikes/a.jpeg"]));
        hikeRepo.Setup(r => r.HandleUserHikesOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        hikeRepo.Setup(r => r.AnonymizeSharedHikesOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var webDav = Utilities.MockFactory.WebDavService();

        // Act
        var result = await Build(hikeRepo, webDav: webDav).HandleUserHikesOnUserDeleteAsync(1, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
        webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task HandleUserHikesOnUserDelete_WhenWebDavThrows_StillSucceeds()
    {
        // Arrange — a failed file delete leaves an orphan, but must not block the account deletion
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetDeletableHikeImageUrlsByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<string>>.Success(["hikes/a.jpeg"]));
        hikeRepo.Setup(r => r.HandleUserHikesOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        hikeRepo.Setup(r => r.AnonymizeSharedHikesOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var webDav = Utilities.MockFactory.WebDavService();
        webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ThrowsAsync(new Exception("webdav down"));

        // Act
        var result = await Build(hikeRepo, webDav: webDav).HandleUserHikesOnUserDeleteAsync(1, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task HandleUserHikesOnUserDelete_WhenRowDeleteFails_DoesNotTouchWebDav()
    {
        // Arrange
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetDeletableHikeImageUrlsByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<string>>.Success(["hikes/a.jpeg"]));
        hikeRepo.Setup(r => r.HandleUserHikesOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var webDav = Utilities.MockFactory.WebDavService();

        // Act
        var result = await Build(hikeRepo, webDav: webDav).HandleUserHikesOnUserDeleteAsync(1, CancellationToken.None);

        // Assert — a failed delete stops the flow before anything else is touched
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
        hikeRepo.Verify(r => r.AnonymizeSharedHikesOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
        webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Never);
    }
}
