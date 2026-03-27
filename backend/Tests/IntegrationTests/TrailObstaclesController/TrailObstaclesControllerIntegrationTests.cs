using FluentAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.TrailObstacle;
using WebDataContracts.ResponseModels.TrailObstacle;

namespace IntegrationTests.TrailObstaclesController;

public class TrailObstaclesControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    #region Seed identifiers
    private const string AuthenticatedUser = "firebase-uid-12346"; // User 2: VandrarVennen

    // Trails
    private const string TivedenIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";          // Trail 1 — has obstacles
    private const string GesebolIdentifier = "55e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a";           // Trail 5 — no obstacles
    private const string NonExistentTrailIdentifier = "00000000-0000-0000-0000-000000000000";    // does not exist in DB

    // Obstacles
    private const string Obstacle1Identifier = "ob1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // Obstacle 1 — VandrarVennen has NOT voted
    private const string Obstacle3Identifier = "ob3c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"; // Obstacle 3 — VandrarVennen HAS voted
    #endregion

    public TrailObstaclesControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    [Fact]
    public async Task GetTrailObstacles_WhenObstaclesExist_ShouldReturnOk()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/v1/trailobstacles/trail/{TivedenIdentifier}");
        var obstacles = await response.Content.ReadFromJsonAsync<List<TrailObstacleResponse>>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        obstacles.Should().NotBeNull().And.NotBeEmpty();
    }

    [Fact]
    public async Task GetTrailObstacles_WhenNoObstaclesExist_ShouldReturnOkWithEmptyList()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/v1/trailobstacles/trail/{GesebolIdentifier}");
        var obstacles = await response.Content.ReadFromJsonAsync<List<TrailObstacleResponse>>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        obstacles.Should().NotBeNull().And.BeEmpty();
    }

    [Fact]
    public async Task GetTrailObstacles_WithoutAuthentication_ShouldReturnOk()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/v1/trailobstacles/trail/{TivedenIdentifier}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AddTrailObstacle_WithAuthenticatedUser_ShouldReturnCreated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var obstacle = new TrailObstacleRequest
        {
            TrailIdentifier = TivedenIdentifier,
            Description = "Stort träd har fallit över stigen, svårt att passera.",
            IssueType = "FallenTree"
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/trailobstacles", obstacle);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task AddTrailObstacle_WithoutAuthentication_ShouldReturnUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        var obstacle = new TrailObstacleRequest
        {
            TrailIdentifier = TivedenIdentifier,
            Description = "Stort träd har fallit över stigen, svårt att passera.",
            IssueType = "FallenTree"
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/trailobstacles", obstacle);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AddTrailObstacle_WithDescriptionTooShort_ShouldReturnBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var obstacle = new TrailObstacleRequest
        {
            TrailIdentifier = TivedenIdentifier,
            Description = "För kort", // under 15 chars
            IssueType = "FallenTree"
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/trailobstacles", obstacle);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AddTrailObstacle_WithDescriptionTooLong_ShouldReturnBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var obstacle = new TrailObstacleRequest
        {
            TrailIdentifier = TivedenIdentifier,
            Description = new string('a', 501), // over 500 chars
            IssueType = "FallenTree"
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/trailobstacles", obstacle);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AddTrailObstacle_WithNonExistentTrailIdentifier_ShouldReturnNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var obstacle = new TrailObstacleRequest
        {
            TrailIdentifier = NonExistentTrailIdentifier,
            Description = "Stort träd blockerar stigen helt och hållet.",
            IssueType = "FallenTree"
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/trailobstacles", obstacle);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task AddTrailObstacle_WithValidCoordinates_ShouldReturnCreated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var obstacle = new TrailObstacleRequest
        {
            TrailIdentifier = TivedenIdentifier,
            Description = "Stort träd blockerar stigen helt och hållet.",
            IssueType = "FallenTree",
            IncidentLongitude = 12.8382551042m,
            IncidentLatitude = 57.7291353665m
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/trailobstacles", obstacle);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task AddTrailObstacle_WithLongitudeOutOfRange_ShouldReturnBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var obstacle = new TrailObstacleRequest
        {
            TrailIdentifier = TivedenIdentifier,
            Description = "Stort träd blockerar stigen helt och hållet.",
            IssueType = "FallenTree",
            IncidentLongitude = 181.0000000001m, // max is 180
            IncidentLatitude = 57.7291353665m
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/trailobstacles", obstacle);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AddTrailObstacle_WithLatitudeOutOfRange_ShouldReturnBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var obstacle = new TrailObstacleRequest
        {
            TrailIdentifier = TivedenIdentifier,
            Description = "Stort träd blockerar stigen helt och hållet.",
            IssueType = "FallenTree",
            IncidentLongitude = 12.8382551042m,
            IncidentLatitude = 90.0000000001m // max is 90
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/trailobstacles", obstacle);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AddSolvedVote_WithAuthenticatedUser_ShouldReturnOk()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.PostAsync($"/api/v1/trailobstacles/solve/{Obstacle1Identifier}", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AddSolvedVote_WithoutAuthentication_ShouldReturnUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsync($"/api/v1/trailobstacles/solve/{Obstacle1Identifier}", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AddSolvedVote_WhenUserAlreadyVoted_ShouldReturnConflict()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.PostAsync($"/api/v1/trailobstacles/solve/{Obstacle3Identifier}", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task AddSolvedVote_WithNonExistentObstacleIdentifier_ShouldReturnNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.PostAsync("/api/v1/trailobstacles/solve/non-existent-obstacle", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteSolvedVote_WithAuthenticatedUser_ShouldReturnNoContent()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.DeleteAsync($"/api/v1/trailobstacles/solve/{Obstacle3Identifier}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeleteSolvedVote_WithoutAuthentication_ShouldReturnUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.DeleteAsync($"/api/v1/trailobstacles/solve/{Obstacle3Identifier}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteSolvedVote_WhenVoteDoesNotExist_ShouldReturnNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.DeleteAsync($"/api/v1/trailobstacles/solve/{Obstacle1Identifier}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
