using FluentAssertions;
using Microsoft.AspNetCore.Http;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.ResponseModels.Review;

namespace IntegrationTests.ReviewController;

public class ReviewControllerIntegrationsTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string AuthenticatedUser = "firebase-uid-12346"; // User 2: VandrarVennen

    public ReviewControllerIntegrationsTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    [Fact]
    public async Task GetReviews_ByTrailIdentifier_ReturnsSuccess()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var trailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";

        // Act
        var response = await client.GetAsync($"/api/v1/review/trail/{trailIdentifier}");
        var reviews = await response.Content.ReadFromJsonAsync<List<ReviewResponse>>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        reviews.Should().NotBeNull();
        reviews.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetReviews_ByTrailIdentifier_NoReviews_ReturnsNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var trailWithoutReviews = "66f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b";

        // Act
        var response = await client.GetAsync($"/api/v1/review/trail/{trailWithoutReviews}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetReviews_WithInvalid_TrailIdentifier_ReturnsNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var invalidTrailIdentifier = "i-am-an-invalid-trail-identifier";

        // Act
        var response = await client.GetAsync($"/api/v1/review/trail/{invalidTrailIdentifier}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task AddReview_WithAuthenticatedUser_ReturnsCreated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var trailIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c"; // Nässlehult

        var formData = new MultipartFormDataContent
        {
            { new StringContent(trailIdentifier), "TrailIdentifier" },
            { new StringContent("An amazing trail with breathtaking views!"), "TrailReview" },
            { new StringContent("4.5"), "Grade" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/review/create", formData);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task AddReview_WithoutAuthentication_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        var trailIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c"; // Nässlehult

        var formData = new MultipartFormDataContent
        {
            { new StringContent(trailIdentifier), "TrailIdentifier" },
            { new StringContent("An amazing trail with breathtaking views!"), "TrailReview" },
            { new StringContent("4.5"), "Grade" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/review/create", formData);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AddReview_WithInvalidGrade_ReturnsBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var trailIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c"; // Nässlehult
        var formData = new MultipartFormDataContent
        {
            { new StringContent(trailIdentifier), "TrailIdentifier" },
            { new StringContent("An amazing trail with breathtaking views!"), "TrailReview" },
            { new StringContent("1337"), "Grade" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/review/create", formData);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AddReview_WithNonExistentTrailIdentifier_ReturnsNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var invalidTrailIdentifier = "i-am-an-invalid-trail-identifier";
        var formData = new MultipartFormDataContent
        {
            { new StringContent(invalidTrailIdentifier), "TrailIdentifier" },
            { new StringContent("An amazing trail with breathtaking views!"), "TrailReview" },
            { new StringContent("4.5"), "Grade" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/review/create", formData);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteReview_WithAuthenticatedUser_ShouldReturnNoContent()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var reviewIdentifier = "r1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // Review by VandrarVennen
        // Act

        var response = await client.DeleteAsync($"/api/v1/review/{reviewIdentifier}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeleteReview_WithoutAuthentication_ShouldReturnUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        var reviewIdentifier = "r1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // Review by VandrarVennen

        // Act
        var response = await client.DeleteAsync($"/api/v1/review/{reviewIdentifier}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
