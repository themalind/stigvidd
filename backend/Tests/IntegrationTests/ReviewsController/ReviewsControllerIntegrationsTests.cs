using FluentAssertions;
using Microsoft.AspNetCore.Http;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.ResponseModels.Review;

namespace IntegrationTests.ReviewsController;

public class ReviewsControllerIntegrationsTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    #region Seed identifiers
    private const string AuthenticatedUser = "firebase-uid-12346"; // User 2: VandrarVennen

    // Trails
    private const string TivedenIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";    // 2 reviews seeded
    private const string HultaforsIdentifier = "66f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b";  // 0 reviews seeded
    private const string NassehultIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c";  // 2 reviews seeded
    private const string NonExistentTrailIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c58"; // does not exist

    // Reviews
    private const string Review1Identifier = "r1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // by VandrarVennen, on Tiveden
    private const string Review2Identifier = "r2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // by NaturElskaren (another user)
    #endregion

    public ReviewsControllerIntegrationsTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    [Fact]
    public async Task GetReviews_ByTrailIdentifier_WhenReviewsExists_ShouldReturnSuccess()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        int page = 0;
        int limit = 2;

        // Act
        var response = await client.GetAsync($"/api/v1/reviews/trail/{TivedenIdentifier}?page={page}&limit={limit}");
        var pagedReviews = await response.Content.ReadFromJsonAsync<PagedReviewResponse>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        pagedReviews.Should().NotBeNull();
        pagedReviews.Reviews.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetReviews_ByTrailIdentifier_NoReviews_ShouldReturnSuccess()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        int page = 0;
        int limit = 10;

        // Act
        var response = await client.GetAsync($"/api/v1/reviews/trail/{HultaforsIdentifier}?page={page}&limit={limit}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetReviews_WithInvalid_TrailIdentifier_ShouldReturnEmptyCollection()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        int page = 0;
        int limit = 10;

        // Act
        var response = await client.GetAsync($"/api/v1/reviews/trail/i-am-an-invalid-trail-identifier?page={page}&limit={limit}");
        var pagedReviews = await response.Content.ReadFromJsonAsync<PagedReviewResponse>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        pagedReviews.Should().NotBeNull();
        pagedReviews.Reviews.Should().BeEmpty();
    }

    [Fact]
    public async Task AddReview_WithAuthenticatedUser_ShouldReturnCreated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var formData = new MultipartFormDataContent
        {
            { new StringContent(NassehultIdentifier), "TrailIdentifier" },
            { new StringContent("An amazing trail with breathtaking views!"), "TrailReview" },
            { new StringContent("4.5"), "Rating" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/reviews/create", formData);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task AddReview_WithoutAuthentication_ShouldReturnUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        var formData = new MultipartFormDataContent
        {
            { new StringContent(NassehultIdentifier), "TrailIdentifier" },
            { new StringContent("An amazing trail with breathtaking views!"), "TrailReview" },
            { new StringContent("4.5"), "Rating" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/reviews/create", formData);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AddReview_WithInvalidRating_ShouldReturnBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var formData = new MultipartFormDataContent
        {
            { new StringContent(NassehultIdentifier), "TrailIdentifier" },
            { new StringContent("An amazing trail with breathtaking views!"), "TrailReview" },
            { new StringContent("1337"), "Rating" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/reviews/create", formData);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AddReview_WithNonExistentTrailIdentifier_ShouldReturnNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var formData = new MultipartFormDataContent
        {
            { new StringContent(NonExistentTrailIdentifier), "TrailIdentifier" },
            { new StringContent("An amazing trail with breathtaking views!"), "TrailReview" },
            { new StringContent("4.5"), "Rating" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/reviews/create", formData);

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

        // Act
        var response = await client.DeleteAsync($"/api/v1/reviews/{Review1Identifier}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeleteReview_WithoutAuthentication_ShouldReturnUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.DeleteAsync($"/api/v1/reviews/{Review1Identifier}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // Claudetests

    [Fact]
    public async Task GetReviews_WithPagination_ShouldReturnHasMoreTrue()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        int page = 0;
        int limit = 1;

        // Act
        var response = await client.GetAsync($"/api/v1/reviews/trail/{TivedenIdentifier}?page={page}&limit={limit}");
        var pagedReviews = await response.Content.ReadFromJsonAsync<PagedReviewResponse>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        pagedReviews.Should().NotBeNull();
        pagedReviews.Reviews.Should().HaveCount(1);
        pagedReviews.HasMore.Should().BeTrue();
        pagedReviews.Total.Should().Be(2);
    }

    [Fact]
    public async Task GetReviews_WhenLimitExceedsCount_ShouldReturnHasMoreFalse()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        int page = 0;
        int limit = 10;

        // Act
        var response = await client.GetAsync($"/api/v1/reviews/trail/{TivedenIdentifier}?page={page}&limit={limit}");
        var pagedReviews = await response.Content.ReadFromJsonAsync<PagedReviewResponse>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        pagedReviews.Should().NotBeNull();
        pagedReviews!.Reviews.Should().HaveCount(2);
        pagedReviews.HasMore.Should().BeFalse();
        pagedReviews.Total.Should().Be(2);
    }

    [Fact]
    public async Task GetReviews_OnSecondPage_ShouldReturnRemainingReviews()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        int page = 1;
        int limit = 1;

        // Act
        var response = await client.GetAsync($"/api/v1/reviews/trail/{NassehultIdentifier}?page={page}&limit={limit}");
        var pagedReviews = await response.Content.ReadFromJsonAsync<PagedReviewResponse>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        pagedReviews.Should().NotBeNull();
        pagedReviews!.Reviews.Should().HaveCount(1);
        pagedReviews.HasMore.Should().BeFalse();
    }

    [Fact]
    public async Task GetReviews_BeyondLastPage_ShouldReturnEmptyCollection()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        int page = 10;
        int limit = 10;

        // Act
        var response = await client.GetAsync($"/api/v1/reviews/trail/{NassehultIdentifier}?page={page}&limit={limit}");
        var pagedReviews = await response.Content.ReadFromJsonAsync<PagedReviewResponse>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        pagedReviews.Should().NotBeNull();
        pagedReviews.Reviews.Should().BeEmpty();
        pagedReviews.HasMore.Should().BeFalse();
        pagedReviews.Total.Should().Be(2);
    }

    [Fact]
    public async Task AddReview_WithRatingBelowMinValue_ShouldReturnBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var formData = new MultipartFormDataContent
        {
            { new StringContent(NassehultIdentifier), "TrailIdentifier" },
            { new StringContent("Test review"), "TrailReview" },
            { new StringContent("0.5"), "Rating" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/reviews/create", formData);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AddReview_WithRatingAtMinValue_ShouldReturnCreated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var formData = new MultipartFormDataContent
        {
            { new StringContent(NassehultIdentifier), "TrailIdentifier" },
            { new StringContent("Minimum rating review"), "TrailReview" },
            { new StringContent("1"), "Rating" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/reviews/create", formData);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task AddReview_WithRatingAtMaxValue_ShouldReturnCreated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var formData = new MultipartFormDataContent
        {
            { new StringContent(NassehultIdentifier), "TrailIdentifier" },
            { new StringContent("Maximum rating review"), "TrailReview" },
            { new StringContent("5"), "Rating" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/reviews/create", formData);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task AddReview_WithRatingAboveMaxValue_ShouldReturnBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var formData = new MultipartFormDataContent
        {
            { new StringContent(NassehultIdentifier), "TrailIdentifier" },
            { new StringContent("Test review"), "TrailReview" },
            { new StringContent("5.1"), "Rating" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/reviews/create", formData);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AddReview_WithoutTrailReview_ShouldReturnCreated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var formData = new MultipartFormDataContent
        {
            { new StringContent(NassehultIdentifier), "TrailIdentifier" },
            { new StringContent("4"), "Rating" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/reviews/create", formData);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task AddReview_WithImages_ShouldReturnCreated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var fakeImageBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }; // minimal JPEG header

        var imageContent1 = new ByteArrayContent(fakeImageBytes);
        imageContent1.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");

        var imageContent2 = new ByteArrayContent(fakeImageBytes);
        imageContent2.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");

        var formData = new MultipartFormDataContent
        {
            { new StringContent(NassehultIdentifier), "TrailIdentifier" },
            { new StringContent("Great trail!"), "TrailReview" },
            { new StringContent("4.5"), "Rating" },
            { imageContent1, "images", "review-image-1.jpg" },
            { imageContent2, "images", "review-image-2.jpg" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/reviews/create", formData);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task DeleteReview_WithNonExistentReviewIdentifier_ShouldReturnNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.DeleteAsync($"/api/v1/reviews/non-existent-review-identifier");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteReview_BelongingToAnotherUser_ShouldReturnNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser); // VandrarVennen

        // Act — Review2 belongs to NaturElskaren, not VandrarVennen
        var response = await client.DeleteAsync($"/api/v1/reviews/{Review2Identifier}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
