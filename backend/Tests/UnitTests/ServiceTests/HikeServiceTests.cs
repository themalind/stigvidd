using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data.Entities;
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
        Mock<IHikeShareRecipientRepository>? shareRepo = null) =>
        new(
            (hikeRepo ?? new Mock<IHikeRepository>()).Object,
            new HikeResponseFactory(),
            (userRepo ?? new Mock<IUserRepository>()).Object,
            (shareRepo ?? new Mock<IHikeShareRecipientRepository>()).Object);

    private static CreateHikeRequest ValidRequest() => new()
    {
        Name = "TestHike",
        HikeLength = 5000,
        Duration = 1800000,
        Coordinates = "[{\"latitude\":57.62,\"longitude\":12.81},{\"latitude\":57.64,\"longitude\":12.83}]",
        Description = "Description",
        GettingThere = "Getting there",
        ParkingInfo = "Parking info",
    };

    [Fact]
    public async Task CreateHike_WhenUserExists_ReturnsSuccess()
    {
        // Arrange
        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserIdByIdentifierAsync(Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.CreateHikeAsync(It.IsAny<Hike>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(Utilities.Stubs.Hike()));

        // Act
        var result = await Build(hikeRepo, userRepo).CreateHikeAsync(ValidRequest(), Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task CreateHike_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

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
        userRepo.Setup(r => r.GetUserIdByIdentifierAsync(Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
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
            Coordinates = "[" + string.Join(",", points) + "]",
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

        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserIdByIdentifierAsync(Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        // Act
        var result = await Build(userRepo: userRepo, hikeRepo: hikeRepo).CreateHikeAsync(ValidRequest(), Utilities.Identifiers.User, CancellationToken.None);

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
            Description = "Scenic route through the forest"
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
    public async Task GetHikes_WithoutFilter_ReturnsAll()
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
        var result = await Build(hikeRepo).GetHikesAsync(null, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetHikes_WhenRepositoryFails_ReturnsInternalServerError()
    {
        // Arrange
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikesAsync(It.IsAny<int?>(), It.IsAny<Expression<Func<Hike, HikeOverviewResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<HikeOverviewResponse>>.Error());

        // Act
        var result = await Build(hikeRepo).GetHikesAsync(null, CancellationToken.None);

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
        hikeRepo.Setup(r => r.SoftDeleteHikeAsync(hike, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(hikeRepo, Utilities.MockFactory.UserRepositoryFoundByIdentifier()).SoftDeleteHikeAsync(Utilities.Identifiers.Hike1, Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteHike_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.NotFound());

        // Act
        var result = await Build(hikeRepo, Utilities.MockFactory.UserRepositoryFoundByIdentifier()).SoftDeleteHikeAsync("no-such", Utilities.Identifiers.User, CancellationToken.None);

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
        var result = await Build(hikeRepo, userRepo).SoftDeleteHikeAsync(Utilities.Identifiers.Hike1, "other-user", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
    }
}
