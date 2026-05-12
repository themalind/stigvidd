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
        Mock<IUserRepository>? userRepo = null) =>
        new(
            (hikeRepo ?? new Mock<IHikeRepository>()).Object,
            new HikeResponseFactory(),
            (userRepo ?? new Mock<IUserRepository>()).Object);

    private static CreateHikeRequest ValidRequest() => new()
    {
        Name = "TestHike",
        HikeLength = 5000,
        Duration = 1800000,
        Coordinates = "[]",
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

    [Fact]
    public async Task CreateHike_WithEmptyName_ReturnsBadRequest()
    {
        // Arrange
        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserIdByIdentifierAsync(Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.CreateHikeAsync(It.IsAny<Hike>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(Utilities.Stubs.Hike()));

        var request = new CreateHikeRequest { Name = "", HikeLength = 5000, Duration = 1800000, Coordinates = "[]" };

        // Act
        var result = await Build(userRepo: userRepo, hikeRepo: hikeRepo).CreateHikeAsync(request, Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task CreateHike_WithZeroHikeLength_ReturnsBadRequest()
    {
        // Arrange
        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserIdByIdentifierAsync(Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.CreateHikeAsync(It.IsAny<Hike>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(Utilities.Stubs.Hike()));

        var request = new CreateHikeRequest { Name = "Hike", HikeLength = 0, Duration = 1800000, Coordinates = "[]" };

        // Act
        var result = await Build(userRepo: userRepo, hikeRepo: hikeRepo).CreateHikeAsync(request, Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task CreateHike_WithZeroDuration_ReturnsBadRequest()
    {
        // Arrange
        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserIdByIdentifierAsync(Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.CreateHikeAsync(It.IsAny<Hike>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(Utilities.Stubs.Hike()));

        var request = new CreateHikeRequest { Name = "Hike", HikeLength = 5000, Duration = 0, Coordinates = "[]" };

        // Act
        var result = await Build(userRepo: userRepo, hikeRepo: hikeRepo).CreateHikeAsync(request, Utilities.Identifiers.User, CancellationToken.None);

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
        var result = await Build(hikeRepo).GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Identifier.Should().Be(Utilities.Identifiers.Hike1);
        result.Value.Name.Should().Be("TestHike1");
    }

    [Fact]
    public async Task GetHikeByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.NotFound());

        // Act
        var result = await Build(hikeRepo).GetHikeByIdentifierAsync("no-such-hike", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetHikes_WithoutFilter_ReturnsAll()
    {
        // Arrange
        IReadOnlyCollection<HikeOverviewResponse> list =
        [
            HikeOverviewResponse.Create("id1", "H1", 10, 3600000, "[]", Utilities.Identifiers.User),
            HikeOverviewResponse.Create("id2", "H2", 20, 7200000, "[]", Utilities.Identifiers.User),
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
    public async Task UpdateHike_WhenNotOwner_ReturnsUnauthorized()
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
        result.Message!.StatusCode.Should().Be(401);
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
    public async Task DeleteHike_WhenNotOwner_ReturnsUnauthorized()
    {
        // Arrange
        var hike = Utilities.Stubs.Hike();
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(Utilities.Identifiers.Hike1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));

        var userRepo = new Mock<IUserRepository>();
        var otherUser = new User { Id = 2, Identifier = "other-user", NickName = "Other", Email = "other@test.com", FirebaseUid = "uid2" };
        userRepo.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, User>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<User>.Success(otherUser));

        // Act
        var result = await Build(hikeRepo, userRepo).SoftDeleteHikeAsync(Utilities.Identifiers.Hike1, "other-user", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(401);
    }
}
