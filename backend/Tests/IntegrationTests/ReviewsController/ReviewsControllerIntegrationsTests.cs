// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
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
    public async Task Database_RefusesASecondReviewByTheSameUserOnTheSameTrail()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StigViddDbContext>();
        var existing = await db.Reviews.FirstAsync(r => r.Identifier == Review1Identifier, TestContext.Current.CancellationToken);
        db.Reviews.Add(new Review { Rating = 3M, TrailId = existing.TrailId, UserId = existing.UserId });

        var save = () => db.SaveChangesAsync(TestContext.Current.CancellationToken);

        await save.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task Database_KeepsEveryReviewOfDeletedAuthorsOnOneTrail()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StigViddDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        var trailId = await db.Trails.Where(t => t.Identifier == HultaforsIdentifier).Select(t => t.Id).FirstAsync(TestContext.Current.CancellationToken);
        db.Reviews.AddRange(
            new Review { Rating = 3M, TrailId = trailId, UserId = null },
            new Review { Rating = 4M, TrailId = trailId, UserId = null });

        var save = () => db.SaveChangesAsync(TestContext.Current.CancellationToken);

        await save.Should().NotThrowAsync();
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
        var response = await client.GetAsync($"/api/v1/reviews/trail/{TivedenIdentifier}?page={page}&limit={limit}", TestContext.Current.CancellationToken);
        var pagedReviews = await response.Content.ReadFromJsonAsync<PagedReviewResponse>(TestContext.Current.CancellationToken);

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
        var response = await client.GetAsync($"/api/v1/reviews/trail/{HultaforsIdentifier}?page={page}&limit={limit}", TestContext.Current.CancellationToken);

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
        var response = await client.GetAsync($"/api/v1/reviews/trail/i-am-an-invalid-trail-identifier?page={page}&limit={limit}", TestContext.Current.CancellationToken);
        var pagedReviews = await response.Content.ReadFromJsonAsync<PagedReviewResponse>(TestContext.Current.CancellationToken);

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
        var response = await client.PostAsync("/api/v1/reviews/create", formData, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task AddReview_WhenUserAlreadyReviewedTheTrail_ShouldReturnConflict()
    {
        // Arrange — VandrarVennen already owns Review 1 on Tiveden
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var formData = new MultipartFormDataContent
        {
            { new StringContent(TivedenIdentifier), "TrailIdentifier" },
            { new StringContent("Trying to review the same trail twice."), "TrailReview" },
            { new StringContent("4.5"), "Rating" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/reviews/create", formData, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);

        // The first review is untouched
        var getResponse = await client.GetAsync($"/api/v1/reviews/trail/{TivedenIdentifier}?page=0&limit=20", TestContext.Current.CancellationToken);
        var paged = await getResponse.Content.ReadFromJsonAsync<PagedReviewResponse>(TestContext.Current.CancellationToken);
        paged.Should().NotBeNull();
        paged.Reviews.Should().ContainSingle(r => r.Identifier == Review1Identifier);
    }

    [Fact]
    public async Task HasReviewedTrail_WhenTheUserHasReviewedIt_ShouldReturnTrue()
    {
        // Arrange — VandrarVennen owns Review 1 on Tiveden
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.GetAsync($"/api/v1/reviews/trail/{TivedenIdentifier}/mine", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<bool>(TestContext.Current.CancellationToken)).Should().BeTrue();
    }

    [Fact]
    public async Task HasReviewedTrail_WhenTheUserHasNot_ShouldReturnFalse()
    {
        // Arrange — Hultafors has no seeded reviews at all
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.GetAsync($"/api/v1/reviews/trail/{HultaforsIdentifier}/mine", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<bool>(TestContext.Current.CancellationToken)).Should().BeFalse();
    }

    [Fact]
    public async Task HasReviewedTrail_WithoutAuthentication_ShouldReturnUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/v1/reviews/trail/{TivedenIdentifier}/mine", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task HasReviewedTrail_AfterDeletingTheOwnReview_ShouldReturnFalseAgain()
    {
        // Arrange — VandrarVennen deletes their only review on Tiveden
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        await client.DeleteAsync($"/api/v1/reviews/{Review1Identifier}", TestContext.Current.CancellationToken);

        // Act
        var response = await client.GetAsync($"/api/v1/reviews/trail/{TivedenIdentifier}/mine", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<bool>(TestContext.Current.CancellationToken)).Should().BeFalse();
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
        var response = await client.PostAsync("/api/v1/reviews/create", formData, TestContext.Current.CancellationToken);

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
        var response = await client.PostAsync("/api/v1/reviews/create", formData, TestContext.Current.CancellationToken);

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
        var response = await client.PostAsync("/api/v1/reviews/create", formData, TestContext.Current.CancellationToken);

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
        var response = await client.DeleteAsync($"/api/v1/reviews/{Review1Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeleteReview_WithoutAuthentication_ShouldReturnUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.DeleteAsync($"/api/v1/reviews/{Review1Identifier}", TestContext.Current.CancellationToken);

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
        var response = await client.GetAsync($"/api/v1/reviews/trail/{TivedenIdentifier}?page={page}&limit={limit}", TestContext.Current.CancellationToken);
        var pagedReviews = await response.Content.ReadFromJsonAsync<PagedReviewResponse>(TestContext.Current.CancellationToken);

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
        var response = await client.GetAsync($"/api/v1/reviews/trail/{TivedenIdentifier}?page={page}&limit={limit}", TestContext.Current.CancellationToken);
        var pagedReviews = await response.Content.ReadFromJsonAsync<PagedReviewResponse>(TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        pagedReviews.Should().NotBeNull();
        pagedReviews.Reviews.Should().HaveCount(2);
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
        var response = await client.GetAsync($"/api/v1/reviews/trail/{NassehultIdentifier}?page={page}&limit={limit}", TestContext.Current.CancellationToken);
        var pagedReviews = await response.Content.ReadFromJsonAsync<PagedReviewResponse>(TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        pagedReviews.Should().NotBeNull();
        pagedReviews.Reviews.Should().HaveCount(1);
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
        var response = await client.GetAsync($"/api/v1/reviews/trail/{NassehultIdentifier}?page={page}&limit={limit}", TestContext.Current.CancellationToken);
        var pagedReviews = await response.Content.ReadFromJsonAsync<PagedReviewResponse>(TestContext.Current.CancellationToken);

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
        var response = await client.PostAsync("/api/v1/reviews/create", formData, TestContext.Current.CancellationToken);

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
        var response = await client.PostAsync("/api/v1/reviews/create", formData, TestContext.Current.CancellationToken);

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
        var response = await client.PostAsync("/api/v1/reviews/create", formData, TestContext.Current.CancellationToken);

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
        var response = await client.PostAsync("/api/v1/reviews/create", formData, TestContext.Current.CancellationToken);

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
        var response = await client.PostAsync("/api/v1/reviews/create", formData, TestContext.Current.CancellationToken);

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

        var fakeImageBytes = TestImages.Jpeg();

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
        var response = await client.PostAsync("/api/v1/reviews/create", formData, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task AddReview_WithGpsTaggedImages_StoresThemWithoutExif()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var taggedBytes = TestImages.JpegWithGps();
        TestImages.HasExif(taggedBytes).Should().BeTrue("the source must carry EXIF");

        var imageContent = new ByteArrayContent(taggedBytes);
        imageContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");

        var formData = new MultipartFormDataContent
        {
            { new StringContent(NassehultIdentifier), "TrailIdentifier" },
            { new StringContent("Tagged photo"), "TrailReview" },
            { new StringContent("4.5"), "Rating" },
            { imageContent, "images", "review-image-1.jpg" }
        };

        _factory.UploadedFileBytes.Clear();

        // Act
        var response = await client.PostAsync("/api/v1/reviews/create", formData, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        _factory.UploadedFileBytes.Should().ContainSingle();
        TestImages.HasExif(_factory.UploadedFileBytes[0]).Should().BeFalse();
    }

    [Fact]
    public async Task DeleteReview_WithNonExistentReviewIdentifier_ShouldReturnNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.DeleteAsync($"/api/v1/reviews/non-existent-review-identifier", TestContext.Current.CancellationToken);

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
        var response = await client.DeleteAsync($"/api/v1/reviews/{Review2Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetOwnReview_WhenTheUserHasReviewedTheTrail_ShouldReturnIt()
    {
        // Arrange — VandrarVennen owns Review 1 on Tiveden
        var client = AuthenticatedClient();

        // Act
        var response = await client.GetAsync($"/api/v1/reviews/trail/{TivedenIdentifier}/mine/review", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var review = await response.Content.ReadFromJsonAsync<ReviewResponse>(TestContext.Current.CancellationToken);
        review.Should().NotBeNull();
        review.Identifier.Should().Be(Review1Identifier);
    }

    [Fact]
    public async Task GetOwnReview_WhenTheUserHasNotReviewedTheTrail_ShouldReturnNotFound()
    {
        // Arrange
        var client = AuthenticatedClient();

        // Act
        var response = await client.GetAsync($"/api/v1/reviews/trail/{HultaforsIdentifier}/mine/review", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetOwnReview_WithoutAuthentication_ShouldReturnUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/v1/reviews/trail/{TivedenIdentifier}/mine/review", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UpdateReview_ByTheAuthor_ShouldSaveTheEditAndMarkItEdited()
    {
        // Arrange
        var client = AuthenticatedClient();
        var formData = UpdateForm("3", "Lerigt efter regnet.");
        formData.Add(new StringContent("rev-img-1"), "RemovedImageIdentifiers");

        // Act
        var response = await client.PutAsync($"/api/v1/reviews/{Review1Identifier}", formData, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await response.Content.ReadFromJsonAsync<ReviewResponse>(TestContext.Current.CancellationToken);
        updated.Should().NotBeNull();
        updated.TrailReview.Should().Be("Lerigt efter regnet.");
        updated.Rating.Should().Be(3M);
        updated.EditedAt.Should().NotBeNull();
        updated.ReviewImages.Should().NotBeNull();
        updated.ReviewImages.Should().NotContain(image => image.Identifier == "rev-img-1");

        var getResponse = await client.GetAsync($"/api/v1/reviews/trail/{TivedenIdentifier}?page=0&limit=20", TestContext.Current.CancellationToken);
        var paged = await getResponse.Content.ReadFromJsonAsync<PagedReviewResponse>(TestContext.Current.CancellationToken);
        paged.Should().NotBeNull();
        var listed = paged.Reviews.Single(r => r.Identifier == Review1Identifier);
        listed.TrailReview.Should().Be("Lerigt efter regnet.");
        listed.EditedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateReview_WithANewImage_ShouldAddIt()
    {
        // Arrange
        var client = AuthenticatedClient();
        var formData = UpdateForm("4", null);
        formData.Add(JpegPart(), "images", "new.jpg");

        // Act
        var response = await client.PutAsync($"/api/v1/reviews/{Review1Identifier}", formData, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await response.Content.ReadFromJsonAsync<ReviewResponse>(TestContext.Current.CancellationToken);
        updated.Should().NotBeNull();
        updated.ReviewImages.Should().NotBeNull();
        updated.ReviewImages.Should().HaveCount(3);
    }

    [Fact]
    public async Task UpdateReview_PastTheImageLimit_ShouldReturnBadRequest()
    {
        // Arrange — Review1 already has two images
        var client = AuthenticatedClient();
        var formData = UpdateForm("4", null);

        formData.Add(JpegPart(), "images", "new1.jpg");
        formData.Add(JpegPart(), "images", "new2.jpg");

        // Act
        var response = await client.PutAsync($"/api/v1/reviews/{Review1Identifier}", formData, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task UpdateReview_BelongingToAnotherUser_ShouldReturnNotFound()
    {
        // Arrange
        var client = AuthenticatedClient();

        // Act — Review2 belongs to NaturElskaren, not VandrarVennen
        var response = await client.PutAsync($"/api/v1/reviews/{Review2Identifier}", UpdateForm("1", "Kapat"), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateReview_WithoutAuthentication_ShouldReturnUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.PutAsync($"/api/v1/reviews/{Review1Identifier}", UpdateForm("3", "text"), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("5.5")]
    public async Task UpdateReview_WithRatingOutOfRange_ShouldReturnBadRequest(string rating)
    {
        // Arrange
        var client = AuthenticatedClient();

        // Act
        var response = await client.PutAsync($"/api/v1/reviews/{Review1Identifier}", UpdateForm(rating, "text"), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task UpdateReview_WithTooLongText_ShouldReturnBadRequest()
    {
        // Arrange
        var client = AuthenticatedClient();

        // Act
        var response = await client.PutAsync($"/api/v1/reviews/{Review1Identifier}", UpdateForm("3", new string('a', 501)), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private HttpClient AuthenticatedClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        return client;
    }

    private static ByteArrayContent JpegPart()
    {
        var image = new ByteArrayContent(TestImages.Jpeg());
        image.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        return image;
    }

    private static MultipartFormDataContent UpdateForm(string rating, string? text)
    {
        var formData = new MultipartFormDataContent
        {
            { new StringContent(rating), "Rating" }
        };

        if (text != null)
            formData.Add(new StringContent(text), "TrailReview");

        return formData;
    }
}
