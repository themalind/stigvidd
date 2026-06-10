using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Http;
using Moq;

namespace UnitTests.ServiceTests;

public class FacilityServiceTests
{
    private const string FacilityIdentifier = "fac1a1b2-c3d4-4e5f-6a7b-8c9d0e1f2a3b";

    private static FacilityService Build(Mock<IFacilityRepository>? repo = null) =>
        new((repo ?? new Mock<IFacilityRepository>()).Object, new FacilityResponseFactory());

    private static Facility MakeFacility() => new()
    {
        Identifier = FacilityIdentifier,
        Name = "Grillplats Tiveden",
        FacilityType = FacilityType.FirePit,
        IsAccessible = true,
        Latitude = 58.9M,
        Longitude = 14.5M
    };

    [Fact]
    public async Task CreateFacilityAsync_WhenValid_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.CreateFacilityAsync(It.IsAny<Facility>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(MakeFacility()));

        // Act
        var result = await Build(repo).CreateFacilityAsync("Grillplats Tiveden", 1, true, 14.5M, 58.9M, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Name.Should().Be("Grillplats Tiveden");
    }

    [Fact]
    public async Task CreateFacilityAsync_WhenRepositoryFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.CreateFacilityAsync(It.IsAny<Facility>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Error());

        // Act
        var result = await Build(repo).CreateFacilityAsync("Grillplats", 1, true, 14.5M, 58.9M, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);
    }

    [Theory]
    [InlineData(1, FacilityType.FirePit)]
    [InlineData(2, FacilityType.Shelter)]
    [InlineData(3, FacilityType.FirePit | FacilityType.Shelter)]
    [InlineData(99, FacilityType.None)]
    public async Task CreateFacilityAsync_MapsFacilityTypeCorrectly(int input, FacilityType expected)
    {
        // Arrange
        Facility? captured = null;
        var facility = MakeFacility();
        facility.FacilityType = expected;

        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.CreateFacilityAsync(It.IsAny<Facility>(), It.IsAny<CancellationToken>()))
            .Callback<Facility, CancellationToken>((f, _) => captured = f)
            .ReturnsAsync(RepositoryResult<Facility>.Success(facility));

        // Act
        await Build(repo).CreateFacilityAsync("Name", input, true, 0M, 0M, CancellationToken.None);

        // Assert
        captured.Should().NotBeNull();
        captured.FacilityType.Should().Be(expected);
    }


    [Fact]
    public async Task GetAllAsync_WhenFacilitiesExist_ReturnsAll()
    {
        // Arrange
        IReadOnlyCollection<Facility> facilities = [MakeFacility()];
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<Facility>>.Success(facilities));

        // Act
        var result = await Build(repo).GetAllAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetAllAsync_WhenNoneExist_ReturnsEmptyCollection()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<Facility>>.Success([]));

        // Act
        var result = await Build(repo).GetAllAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAllAsync_WhenRepositoryFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<Facility>>.Error());

        // Act
        var result = await Build(repo).GetAllAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);
    }

    [Fact]
    public async Task GetByIdentifierAsync_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(FacilityIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(MakeFacility()));

        // Act
        var result = await Build(repo).GetByIdentifierAsync(FacilityIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Identifier.Should().Be(FacilityIdentifier);
    }

    [Fact]
    public async Task GetByIdentifierAsync_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.NotFound());

        // Act
        var result = await Build(repo).GetByIdentifierAsync("no-such-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(StatusCodes.Status404NotFound);
    }

    [Fact]
    public async Task GetByIdentifierAsync_WhenRepositoryFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Error());

        // Act
        var result = await Build(repo).GetByIdentifierAsync("some-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);
    }

    [Fact]
    public async Task UpdateFacilityAsync_WhenValid_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(FacilityIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(MakeFacility()));
        repo.Setup(r => r.UpdateAsync(It.IsAny<Facility>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(MakeFacility()));

        // Act
        var result = await Build(repo).UpdateFacilityAsync(FacilityIdentifier, "New Name", null, null, null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateFacilityAsync_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.NotFound());

        // Act
        var result = await Build(repo).UpdateFacilityAsync("no-such-id", "Name", null, null, null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(StatusCodes.Status404NotFound);
    }

    [Fact]
    public async Task UpdateFacilityAsync_WhenFetchFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Error());

        // Act
        var result = await Build(repo).UpdateFacilityAsync(FacilityIdentifier, "Name", null, null, null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);
    }

    [Fact]
    public async Task UpdateFacilityAsync_WhenUpdateFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(FacilityIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(MakeFacility()));
        repo.Setup(r => r.UpdateAsync(It.IsAny<Facility>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Error());

        // Act
        var result = await Build(repo).UpdateFacilityAsync(FacilityIdentifier, "Name", null, null, null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);
    }

    [Fact]
    public async Task UpdateFacilityAsync_OnlyUpdatesProvidedFields()
    {
        // Arrange
        var original = MakeFacility();
        Facility? captured = null;

        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(FacilityIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(original));
        repo.Setup(r => r.UpdateAsync(It.IsAny<Facility>(), It.IsAny<CancellationToken>()))
            .Callback<Facility, CancellationToken>((f, _) => captured = f)
            .ReturnsAsync(RepositoryResult<Facility>.Success(original));

        // Act — only name is provided, all other fields should remain unchanged
        await Build(repo).UpdateFacilityAsync(FacilityIdentifier, "New Name", null, null, null, null, CancellationToken.None);

        // Assert
        captured.Should().NotBeNull();
        captured.Name.Should().Be("New Name");
        captured.FacilityType.Should().Be(original.FacilityType);
        captured.IsAccessible.Should().Be(original.IsAccessible);
        captured.Latitude.Should().Be(original.Latitude);
        captured.Longitude.Should().Be(original.Longitude);
    }

    [Fact]
    public async Task DeleteAsync_WhenValid_ReturnsSuccess()
    {
        // Arrange
        var facility = MakeFacility();
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(FacilityIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(facility));
        repo.Setup(r => r.DeleteAsync(facility, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo).DeleteAsync(FacilityIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteAsync_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.NotFound());

        // Act
        var result = await Build(repo).DeleteAsync("no-such-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(StatusCodes.Status404NotFound);
    }

    [Fact]
    public async Task DeleteAsync_WhenFetchFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Error());

        // Act
        var result = await Build(repo).DeleteAsync(FacilityIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);
    }

    [Fact]
    public async Task DeleteAsync_WhenDeleteFails_ReturnsInternalServerError()
    {
        // Arrange
        var facility = MakeFacility();
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(FacilityIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(facility));
        repo.Setup(r => r.DeleteAsync(facility, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        // Act
        var result = await Build(repo).DeleteAsync(FacilityIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);
    }
}
