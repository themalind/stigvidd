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
    public async Task GetReviews_ByTrailIdentifier_WhenReviewsExists_ShouldReturnSuccess()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var trailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
        int page = 0;
        int limit = 2;

        // Act
        var response = await client.GetAsync($"/api/v1/review/trail/{trailIdentifier}?page={page}&limit={limit}");
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

        var trailWithoutReviews = "66f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b";
        int page = 0;
        int limit = 10;

        // Act
        var response = await client.GetAsync($"/api/v1/review/trail/{trailWithoutReviews}?page={page}&limit={limit}");

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

        var invalidTrailIdentifier = "i-am-an-invalid-trail-identifier";
        int page = 0;
        int limit = 10;

        // Act
        var response = await client.GetAsync($"/api/v1/review/trail/{invalidTrailIdentifier}?page={page}&limit={limit}");
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
    public async Task AddReview_WithoutAuthentication_ShouldReturnUnauthorized()
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
    public async Task AddReview_WithInvalidGrade_ShouldReturnBadRequest()
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
    public async Task AddReview_WithNonExistentTrailIdentifier_ShouldReturnNotFound()
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
    
    // Claudetests

    [Fact]
    public async Task GetReviews_WithPagination_ShouldReturnHasMoreTrue()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var trailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // Tiveden (has 2 reviews)
        int page = 0;
        int limit = 1;

        // Act
        var response = await client.GetAsync($"/api/v1/review/trail/{trailIdentifier}?page={page}&limit={limit}");
        var pagedReviews = await response.Content.ReadFromJsonAsync<PagedReviewResponse>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        pagedReviews.Should().NotBeNull();
        pagedReviews!.Reviews.Should().HaveCount(1);
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

        var trailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // Tiveden (has 2 reviews)
        int page = 0;
        int limit = 10;

        // Act
        var response = await client.GetAsync($"/api/v1/review/trail/{trailIdentifier}?page={page}&limit={limit}");
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

        var trailIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c"; // Nässehult (has 2 reviews)
        int page = 1;
        int limit = 1;

        // Act
        var response = await client.GetAsync($"/api/v1/review/trail/{trailIdentifier}?page={page}&limit={limit}");
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

        var trailIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c"; // Nässehult (has 2 reviews)
        int page = 10;
        int limit = 10;

        // Act
        var response = await client.GetAsync($"/api/v1/review/trail/{trailIdentifier}?page={page}&limit={limit}");
        var pagedReviews = await response.Content.ReadFromJsonAsync<PagedReviewResponse>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        pagedReviews.Should().NotBeNull();
        pagedReviews!.Reviews.Should().BeEmpty();
        pagedReviews.HasMore.Should().BeFalse();
        pagedReviews.Total.Should().Be(2);
    }

    [Fact]
    public async Task AddReview_WithGradeBelowMinValue_ShouldReturnBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var trailIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c";
        var formData = new MultipartFormDataContent
        {
            { new StringContent(trailIdentifier), "TrailIdentifier" },
            { new StringContent("Test review"), "TrailReview" },
            { new StringContent("0.5"), "Grade" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/review/create", formData);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AddReview_WithGradeAtMinValue_ShouldReturnCreated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var trailIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c";
        var formData = new MultipartFormDataContent
        {
            { new StringContent(trailIdentifier), "TrailIdentifier" },
            { new StringContent("Minimum grade review"), "TrailReview" },
            { new StringContent("1"), "Grade" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/review/create", formData);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task AddReview_WithGradeAtMaxValue_ShouldReturnCreated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var trailIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c";
        var formData = new MultipartFormDataContent
        {
            { new StringContent(trailIdentifier), "TrailIdentifier" },
            { new StringContent("Maximum grade review"), "TrailReview" },
            { new StringContent("5"), "Grade" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/review/create", formData);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task AddReview_WithGradeAboveMaxValue_ShouldReturnBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var trailIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c";
        var formData = new MultipartFormDataContent
        {
            { new StringContent(trailIdentifier), "TrailIdentifier" },
            { new StringContent("Test review"), "TrailReview" },
            { new StringContent("5.1"), "Grade" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/review/create", formData);

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

        var trailIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c";
        var formData = new MultipartFormDataContent
        {
            { new StringContent(trailIdentifier), "TrailIdentifier" },
            { new StringContent("4"), "Grade" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/review/create", formData);

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

        var nonExistentReviewIdentifier = "non-existent-review-identifier";

        // Act
        var response = await client.DeleteAsync($"/api/v1/review/{nonExistentReviewIdentifier}");

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

        // Review by NaturElskaren, not VandrarVennen
        var reviewByOtherUser = "r2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

        // Act
        var response = await client.DeleteAsync($"/api/v1/review/{reviewByOtherUser}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
