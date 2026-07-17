using FluentAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using WebDataContracts.RequestModels.Hike;
using WebDataContracts.ResponseModels.Hike;

namespace IntegrationTests.HikesController;

public class HikesControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    #region Seed identifiers
    private const string BASE_URL = "/api/v1/hikes/";
    private const string AUTHENTICATED_USER = "firebase-uid-12345";  // NaturElskaren
    private const string NOT_AUTHENTICATED_USER = "not-a-valid-uid";

    // Users
    private const string NaturElskarenIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // User 1
    private const string VandrarVennenIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"; // User 2 (creator of TestHike3)

    // Hikes
    private const string TestHike1Identifier = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90"; // by NaturElskaren
    private const string TestHike3Identifier = "91e4c2d7-3b8f-4f6a-9d1c-7a2e5b0c8f13"; // by VandrarVennen, shared with NaturElskaren
    private const string TestHike4Identifier = "c4d8a1b9-6f3e-4c72-8a5d-1e9b2f7c0a46"; // by VandrarVennen, NOT shared
    #endregion

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public HikesControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    [Fact]
    public async Task GetHikeByIdentifierAsync_ShouldReturnOk_WhenIdentifierHasMatch()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        // Act
        var response = await client.GetAsync($"{BASE_URL}{TestHike1Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetHikeByIdentifierAsync_ShouldReturnNotFound_WhenIdentifierHasNoMatch()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        // Act
        var response = await client.GetAsync($"{BASE_URL}not-a-uid", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetHikeByIdentifierAsync_ShouldReturnUnauthorized_WhenUserNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", NOT_AUTHENTICATED_USER);

        // Act
        var response = await client.GetAsync($"{BASE_URL}{TestHike1Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetHikesAsync_ShouldReturnOk_WhenNoQueryIsUsed()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        // Act
        var response = await client.GetAsync(BASE_URL, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetHikesAsync_ShouldReturnOk_WhenQueryIsUsedAndHasMatch()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        // Act
        var response = await client.GetAsync($"{BASE_URL}?createdBy={NaturElskarenIdentifier}", TestContext.Current.CancellationToken);
        var responseObject = await response.Content.ReadFromJsonAsync<HikeResponse[]>(TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        responseObject.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetHikesAsync_ShouldReturnForbidden_WhenCreatedByIsAnotherUser()
    {
        // Arrange — hikes are private; a caller may only list their own.
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        // Act — NaturElskaren attempts to list VandrarVennen's hikes.
        var response = await client.GetAsync($"{BASE_URL}?createdBy={VandrarVennenIdentifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetHikeByIdentifierAsync_ShouldReturnForbidden_WhenNotOwnerAndNotSharedWith()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        // Act — TestHike4 is owned by VandrarVennen and not shared with NaturElskaren.
        var response = await client.GetAsync($"{BASE_URL}{TestHike4Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetHikeByIdentifierAsync_ShouldReturnOk_WhenSharedWithCaller()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        // Act — TestHike3 (owned by VandrarVennen) was shared with NaturElskaren.
        var response = await client.GetAsync($"{BASE_URL}{TestHike3Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetHikesAsync_ShouldReturnUnauthorized_WhenUserNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", NOT_AUTHENTICATED_USER);

        // Act
        var response = await client.GetAsync(BASE_URL, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateHikeAsync_ShouldReturnCreated_WhenHikeIsCreated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        var request = new CreateHikeRequest
        {
            Name = "TestHike1",
            HikeLength = 1000,
            Duration = 60000,
            Coordinates = "[{\"latitude\":57.62,\"longitude\":12.81},{\"latitude\":57.64,\"longitude\":12.83}]"
        };

        // Act
        var response = await client.PostAsJsonAsync(BASE_URL, request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Theory]
    [InlineData("", 1000, 60000)]
    [InlineData("  ", 1000, 60000)]
    [InlineData("ThisNameIsWayTooLongAndIsUnderNoCircumstanceASuitableForAHike", 1000, 60000)]
    [InlineData("MyHike", 0, 60000)]
    [InlineData("MyHike", 1000, 0)]
    public async Task CreateHikeAsync_ShouldReturnBadRequest_WhenRequestPropertiesAreOutsideOfRange(
        string hikeName,
        decimal hikeLength,
        int duration
    )
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        var request = new CreateHikeRequest
        {
            Name = hikeName,
            HikeLength = hikeLength,
            Duration = duration,
            Coordinates = "[]"
        };

        // Act
        var response = await client.PostAsJsonAsync(BASE_URL, request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateHikeAsync_ShouldReturnBadRequest_WhenBodyIsInvalid()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        var request = new StringContent
        (
            "this-is-not-valid",
            Encoding.UTF8,
            "application/json"
        );

        // Act
        var response = await client.PostAsJsonAsync(BASE_URL, request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateHikeAsync_ShouldReturnUnauthorized_WhenUserNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", NOT_AUTHENTICATED_USER);

        var request = new CreateHikeRequest
        {
            Name = "TestHike1",
            HikeLength = 1000,
            Duration = 60000,
            Coordinates = "[]"
        };

        // Act
        var response = await client.PostAsJsonAsync(BASE_URL, request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UpdateHikeAsync_ShouldReturnOk_WhenHikeIsUpdated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        var request = new UpdateHikeRequest { Name = "UpdatedName" };

        // Act
        var response = await client.PutAsJsonAsync($"{BASE_URL}{TestHike1Identifier}", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task UpdateHikeAsync_ShouldReturnNotFound_WhenHikeNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        var request = new UpdateHikeRequest { Name = "UpdatedName" };

        // Act
        var response = await client.PutAsJsonAsync($"{BASE_URL}not-a-valid-identifier", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateHikeAsync_ShouldReturnForbidden_WhenUserIsNotCreator()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        var request = new UpdateHikeRequest { Name = "UpdatedName" };

        // Act — TestHike3 is owned by VandrarVennen, not NaturElskaren
        var response = await client.PutAsJsonAsync($"{BASE_URL}{TestHike3Identifier}", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task UpdateHikeAsync_ShouldReturnUnauthorized_WhenUserNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", NOT_AUTHENTICATED_USER);

        var request = new UpdateHikeRequest { Name = "UpdatedName" };

        // Act
        var response = await client.PutAsJsonAsync($"{BASE_URL}{TestHike1Identifier}", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteHikeAsync_ShouldReturnNoContent_WhenHikeIsDeleted()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}{TestHike1Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeleteHikeAsync_ShouldReturnNotFound_WhenHikeIsNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}not-a-valid-hike-identifier", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteHikeAsync_ShouldReturnForbidden_WhenUserIsNotCreator()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        // Act — TestHike3 is owned by VandrarVennen, not NaturElskaren
        var response = await client.DeleteAsync($"{BASE_URL}{TestHike3Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task DeleteHikeAsync_ShouldReturnUnauthorized_WhenUserNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", NOT_AUTHENTICATED_USER);

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}{TestHike1Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
