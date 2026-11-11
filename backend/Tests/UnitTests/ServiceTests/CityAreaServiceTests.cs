// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Linq.Expressions;
using Core.Interfaces.Repositories;
using Core.Services;
using AwesomeAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using Moq;

namespace UnitTests.ServiceTests;

public class CityAreaServiceTests
{
    private const string CityAreaIdentifier = "area-dalsjofors";

    private static CityAreaResponseFactory BuildFactory()
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");

        return new CityAreaResponseFactory(cfg.Object);
    }

    private static CityAreaService Build(Mock<ICityAreaRepository>? repo = null)
    {
        return new((repo ?? new Mock<ICityAreaRepository>()).Object, BuildFactory());
    }

    private static CityAreaProjection MakeCityArea()
    {
        return new(CityAreaIdentifier, "Dalsjöfors", "Öster om Borås", null, null, null, [], []);
    }

    [Fact]
    public async Task GetAllAsync_WhenCityAreasExist_ReturnsAll()
    {
        // Arrange
        IReadOnlyCollection<CityAreaProjection> cityAreas = [MakeCityArea()];
        var repo = new Mock<ICityAreaRepository>();
        repo.Setup(r => r.GetAllAsync(It.IsAny<Expression<Func<CityArea, CityAreaProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<CityAreaProjection>>.Success(cityAreas));

        // Act
        var result = await Build(repo).GetAllAsync(TestContext.Current.CancellationToken);

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
        var result = await Build(repo).GetAllAsync(TestContext.Current.CancellationToken);

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
        var result = await Build(repo).GetAllAsync(TestContext.Current.CancellationToken);

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
        var result = await Build(repo).GetByIdentifierAsync(CityAreaIdentifier, TestContext.Current.CancellationToken);

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
        var result = await Build(repo).GetByIdentifierAsync("no-such-id", TestContext.Current.CancellationToken);

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
        var result = await Build(repo).GetByIdentifierAsync("some-id", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetLinkSuggestionsAsync_SuggestsAnAreaForEachUnlinkedItem()
    {
        // Arrange
        var sources = new LinkSuggestionSourcesProjection(
            [new SuggestionAreaProjection("area-rya", "Rya åsar", [new LinkedPlaceProjection("Ryaslingan", 57.71, 12.90)])],
            [
                new UnlinkedFacilityProjection("fac-near", "Grillplats", 1, 57.70, 12.90),
                new UnlinkedFacilityProjection("fac-far", "Fiskevatten", 4, null, null),
            ],
            [new UnlinkedTrailProjection("trail-rya", "Rya åsar runt", "Borås", true, null, null)]);
        var repo = new Mock<ICityAreaRepository>();
        repo.Setup(r => r.GetLinkSuggestionSourcesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<LinkSuggestionSourcesProjection>.Success(sources));

        // Act
        var result = await Build(repo).GetLinkSuggestionsAsync(TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Facilities.Single(f => f.Identifier == "fac-near").Suggestions
            .Should().ContainSingle().Which.AreaIdentifier.Should().Be("area-rya");
        result.Value.Facilities.Single(f => f.Identifier == "fac-far").Suggestions.Should().BeEmpty();
        result.Value.Trails.Should().ContainSingle().Which.Suggestions
            .Should().ContainSingle().Which.AreaName.Should().Be("Rya åsar");
    }

    [Fact]
    public async Task GetLinkSuggestionsAsync_WhenRepositoryFails_Returns500()
    {
        // Arrange
        var repo = new Mock<ICityAreaRepository>();
        repo.Setup(r => r.GetLinkSuggestionSourcesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<LinkSuggestionSourcesProjection>.Error());

        // Act
        var result = await Build(repo).GetLinkSuggestionsAsync(TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }
}
