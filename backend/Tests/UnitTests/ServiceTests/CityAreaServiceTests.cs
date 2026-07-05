using System.Linq.Expressions;
using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Moq;

namespace UnitTests.ServiceTests;

public class CityAreaServiceTests
{
    private const string CityAreaIdentifier = "area-dalsjofors";

    private static CityAreaService Build(Mock<ICityAreaRepository>? repo = null) =>
        new((repo ?? new Mock<ICityAreaRepository>()).Object, new CityAreaResponseFactory());

    private static CityAreaProjection MakeCityArea() =>
        new(CityAreaIdentifier, "Dalsjöfors", "Öster om Borås", null, null, null, [], []);

    [Fact]
    public async Task GetAllAsync_WhenCityAreasExist_ReturnsAll()
    {
        // Arrange
        IReadOnlyCollection<CityAreaProjection> cityAreas = [MakeCityArea()];
        var repo = new Mock<ICityAreaRepository>();
        repo.Setup(r => r.GetAllAsync(It.IsAny<Expression<Func<CityArea, CityAreaProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<CityAreaProjection>>.Success(cityAreas));

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
        var repo = new Mock<ICityAreaRepository>();
        repo.Setup(r => r.GetAllAsync(It.IsAny<Expression<Func<CityArea, CityAreaProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<CityAreaProjection>>.Success([]));

        // Act
        var result = await Build(repo).GetAllAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAllAsync_WhenRepositoryFails_Returns500()
    {
        // Arrange
        var repo = new Mock<ICityAreaRepository>();
        repo.Setup(r => r.GetAllAsync(It.IsAny<Expression<Func<CityArea, CityAreaProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<CityAreaProjection>>.Error());

        // Act
        var result = await Build(repo).GetAllAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetByIdentifierAsync_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<ICityAreaRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(CityAreaIdentifier, It.IsAny<Expression<Func<CityArea, CityAreaProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<CityAreaProjection>.Success(MakeCityArea()));

        // Act
        var result = await Build(repo).GetByIdentifierAsync(CityAreaIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Identifier.Should().Be(CityAreaIdentifier);
    }

    [Fact]
    public async Task GetByIdentifierAsync_WhenNotFound_Returns404()
    {
        // Arrange
        var repo = new Mock<ICityAreaRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<CityArea, CityAreaProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<CityAreaProjection>.NotFound());

        // Act
        var result = await Build(repo).GetByIdentifierAsync("no-such-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetByIdentifierAsync_WhenRepositoryFails_Returns500()
    {
        // Arrange
        var repo = new Mock<ICityAreaRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<CityArea, CityAreaProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<CityAreaProjection>.Error());

        // Act
        var result = await Build(repo).GetByIdentifierAsync("some-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }
}
