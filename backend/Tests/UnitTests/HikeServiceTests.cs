using Core;
using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using WebDataContracts.RequestModels.Hike;
using WebDataContracts.ResponseModels.Hike;
using WebDataContracts.ResponseModels.User;

namespace UnitTests;

public class HikeServiceTests
{
    private const string UserIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const string HikeIdentifier = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90";

    private HikeService Build(
        Mock<IHikeResponseRepository>? hikeRepo = null,
        Mock<IUserService>? userSvc = null) =>
        new(
            (hikeRepo ?? new Mock<IHikeResponseRepository>()).Object,
            new HikeResponseFactory(),
            new Mock<ILogger<HikeService>>().Object,
            (userSvc ?? new Mock<IUserService>()).Object);

    private static CreateHikeRequest ValidRequest() => new()
    {
        Name = "TestHike",
        HikeLength = 5000,
        Duration = 1800000,
        Coordinates = "[]"
    };

    private static Hike SeedHike() => new()
    {
        Id = 1,
        Identifier = HikeIdentifier,
        Name = "TestHike1",
        HikeLength = 10,
        Duration = 3600000,
        Coordinates = "[]",
        CreatedBy = UserIdentifier
    };

    private static Mock<IUserService> UserFound() =>
        SetupUser(Result.Ok<UserResponse?>(UserResponse.Create(UserIdentifier, "Nick", "nick@test.com", null, null)));

    private static Mock<IUserService> UserNotFound() =>
        SetupUser(Result.Fail<UserResponse?>(new Message(404, "User not found")));

    private static Mock<IUserService> SetupUser(Result<UserResponse?> result)
    {
        var mock = new Mock<IUserService>();
        mock.Setup(u => u.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(result);
        return mock;
    }


    [Fact]
    public async Task CreateHike_WhenUserExists_ReturnsSuccess()
    {
        var hikeRepo = new Mock<IHikeResponseRepository>();
        hikeRepo.Setup(r => r.CreateHikeAsync(It.IsAny<Hike>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(SeedHike()));

        var result = await Build(hikeRepo, UserFound()).CreateHikeAsync(ValidRequest(), UserIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task CreateHike_WhenUserNotFound_Returns404()
    {
        var result = await Build(userSvc: UserNotFound()).CreateHikeAsync(ValidRequest(), "unknown", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task CreateHike_WithEmptyName_Returns400()
    {
        var request = new CreateHikeRequest { Name = "", HikeLength = 5000, Duration = 1800000, Coordinates = "[]" };

        var result = await Build(userSvc: UserFound()).CreateHikeAsync(request, UserIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task CreateHike_WithZeroHikeLength_Returns400()
    {
        var request = new CreateHikeRequest { Name = "Hike", HikeLength = 0, Duration = 1800000, Coordinates = "[]" };

        var result = await Build(userSvc: UserFound()).CreateHikeAsync(request, UserIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task CreateHike_WithZeroDuration_Returns400()
    {
        var request = new CreateHikeRequest { Name = "Hike", HikeLength = 5000, Duration = 0, Coordinates = "[]" };

        var result = await Build(userSvc: UserFound()).CreateHikeAsync(request, UserIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task CreateHike_WhenRepositoryFails_Returns500()
    {
        var hikeRepo = new Mock<IHikeResponseRepository>();
        hikeRepo.Setup(r => r.CreateHikeAsync(It.IsAny<Hike>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Error());

        var result = await Build(hikeRepo, UserFound()).CreateHikeAsync(ValidRequest(), UserIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }


    [Fact]
    public async Task GetHikeByIdentifier_WhenFound_ReturnsSuccess()
    {
        var hikeRepo = new Mock<IHikeResponseRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(HikeIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(SeedHike()));

        var result = await Build(hikeRepo).GetHikeByIdentifierAsync(HikeIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value!.Identifier.Should().Be(HikeIdentifier);
        result.Value.Name.Should().Be("TestHike1");
    }

    [Fact]
    public async Task GetHikeByIdentifier_WhenNotFound_Returns404()
    {
        var hikeRepo = new Mock<IHikeResponseRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.NotFound());

        var result = await Build(hikeRepo).GetHikeByIdentifierAsync("no-such-hike", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }


    [Fact]
    public async Task GetHikes_WithoutFilter_ReturnsAll()
    {
        IReadOnlyCollection<HikeOverviewResponse> list =
        [
            HikeOverviewResponse.Create("id1", "H1", 10, 3600000, "[]", UserIdentifier),
            HikeOverviewResponse.Create("id2", "H2", 20, 7200000, "[]", UserIdentifier),
        ];
        var hikeRepo = new Mock<IHikeResponseRepository>();
        hikeRepo.Setup(r => r.GetHikesAsync(It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<HikeOverviewResponse>>.Success(list));

        var result = await Build(hikeRepo).GetHikesAsync(null, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetHikes_WhenRepositoryFails_Returns500()
    {
        var hikeRepo = new Mock<IHikeResponseRepository>();
        hikeRepo.Setup(r => r.GetHikesAsync(It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<HikeOverviewResponse>>.Error());

        var result = await Build(hikeRepo).GetHikesAsync(null, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }


    [Fact]
    public async Task DeleteHike_WhenOwner_ReturnsSuccess()
    {
        var hike = SeedHike();
        var hikeRepo = new Mock<IHikeResponseRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(HikeIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));
        hikeRepo.Setup(r => r.DeleteHikeAsync(hike, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var result = await Build(hikeRepo).DeleteHikeAsync(HikeIdentifier, UserIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteHike_WhenNotFound_Returns404()
    {
        var hikeRepo = new Mock<IHikeResponseRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.NotFound());

        var result = await Build(hikeRepo).DeleteHikeAsync("no-such", UserIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteHike_WhenNotOwner_Returns401()
    {
        var hike = SeedHike(); // CreatedBy = UserIdentifier
        var hikeRepo = new Mock<IHikeResponseRepository>();
        hikeRepo.Setup(r => r.GetHikeByIdentifierAsync(HikeIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));

        var result = await Build(hikeRepo).DeleteHikeAsync(HikeIdentifier, "other-user", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(401);
    }
}
