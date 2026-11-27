// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Linq.Expressions;
using Core;
using Core.Interfaces.Repositories.Trails.Models;
using Core.Repositories;
using AwesomeAssertions;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using WebDataContracts.ResponseModels.Review;

namespace UnitTests.RepositoryTests;

public class ReviewRepositoryTests : TestBase
{
    private const string NassehultIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c"; // 2 reviews
    private const string HultaforsIdentifier = "66f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b"; // 0 reviews
    private const string Review1Identifier = "r1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // VandrarVennen, Tiveden, with images
    private const string TivedenIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
    private const int Review1Id = 1;
    private const int MaxImages = 3;
    private const string Review1FirstImageUrl = "https://inkaben.se/stigvidd/mock/review-tiveden-1.jpg";
    private const string Review1SecondImageUrl = "https://inkaben.se/stigvidd/mock/review-tiveden-2.jpg";
    private const string Review5Identifier = "r5e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a"; // Kattleten, no images
    private const string VandrarVennenIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
    private const string NaturElskarenIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const int VandrarVennenId = 2;
    private const int TivedenId = 1;                 // reviewed by user 2 (Review 1) and user 3 (Review 8)
    private const int OtherTrailWithReviewsId = 2;   // reviewed by user 1, not by user 2
    private const int UserWithoutTivedenReviewId = 5;
    private const string KattletenIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a33";

    private static Expression<Func<Review, ReviewResponse>> ReviewSelector =>
        r => new ReviewResponse
        {
            Identifier = r.Identifier,
            TrailReview = r.TrailReview,
            Rating = r.Rating,
            UserName = r.User != null ? r.User.NickName : string.Empty,
            UserIdentifier = r.User != null ? r.User.Identifier : string.Empty,
            TrailIdentifier = r.Trail != null ? r.Trail.Identifier : string.Empty
        };

    private ReviewRepository BuildRepo()
    {
        return new(CreateSeededFactory(), NullLogger<ReviewRepository>.Instance);
    }

    [Fact]
    public async Task GetReviewsByTrailIdentifier_WhenTrailHasReviews_ReturnsCorrectCount()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.GetReviewsByTrailIdentifierAsync(NassehultIdentifier, 0, 10, [], ReviewSelector, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Items.Should().HaveCount(2);
        result.Value.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task GetReviewsByTrailIdentifier_WhenTrailHasNoReviews_ReturnsEmpty()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.GetReviewsByTrailIdentifierAsync(HultaforsIdentifier, 0, 10, [], ReviewSelector, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Items.Should().BeEmpty();
        result.Value.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task GetReviewsByTrailIdentifier_WithLimitOf1_HasMoreIsTrue()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.GetReviewsByTrailIdentifierAsync(NassehultIdentifier, 0, 1, [], ReviewSelector, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Items.Should().HaveCount(1);
        result.Value.HasMore.Should().BeTrue();
        result.Value.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task GetReviewsByTrailIdentifier_OnLastPage_HasMoreIsFalse()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.GetReviewsByTrailIdentifierAsync(NassehultIdentifier, 1, 1, [], ReviewSelector, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Items.Should().HaveCount(1);
        result.Value.HasMore.Should().BeFalse();
    }

    [Fact]
    public async Task GetReviewsByTrailIdentifier_BeyondLastPage_ReturnsEmpty()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.GetReviewsByTrailIdentifierAsync(NassehultIdentifier, 10, 10, [], ReviewSelector, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Items.Should().BeEmpty();
        result.Value.HasMore.Should().BeFalse();
        result.Value.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task GetReviewByIdentifier_WhenFound_ReturnsReview()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.GetReviewByIdentifierAsync(Review1Identifier, VandrarVennenIdentifier, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Identifier.Should().Be(Review1Identifier);
    }

    [Fact]
    public async Task GetReviewByIdentifier_WhenWrongUser_ReturnsNotFound()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.GetReviewByIdentifierAsync(Review1Identifier, KattletenIdentifier, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetReviewByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.GetReviewByIdentifierAsync("no-such-review", VandrarVennenIdentifier, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task AddReview_ShouldPersistAndReturn()
    {
        // Arrange
        var repo = new ReviewRepository(CreateSeededFactory(), NullLogger<ReviewRepository>.Instance);
        var review = new Review
        {
            Identifier = Guid.NewGuid().ToString(),
            TrailReview = "Nice!",
            Rating = 4.5M,
            TrailId = 1,
            UserId = 1
        };

        // Act
        var result = await repo.AddReviewAsync(review, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Rating.Should().Be(4.5M);
    }

    [Fact]
    public async Task GetReviewByTrailAndUser_ReturnsTheirReviewWithImages()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.GetReviewByTrailAndUserAsync(TivedenIdentifier, VandrarVennenIdentifier, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Identifier.Should().Be(Review1Identifier);
        result.Value.ReviewImages.Should().HaveCount(2);
        result.Value.Trail.Should().NotBeNull();
        result.Value.User.Should().NotBeNull();
    }

    [Fact]
    public async Task GetReviewByTrailAndUser_WhenTheUserHasNotReviewedTheTrail_ReturnsNotFound()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.GetReviewByTrailAndUserAsync(HultaforsIdentifier, VandrarVennenIdentifier, TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task UpdateReview_SavesTextRatingAndUpdateTime()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new ReviewRepository(factory, NullLogger<ReviewRepository>.Instance);
        var updatedAt = new DateTime(2026, 11, 25, 12, 0, 0, DateTimeKind.Utc);

        // Act
        var result = await repo.UpdateReviewAsync(new ReviewUpdate(Review1Id, "Ändrad text", 2M, [], [], MaxImages, updatedAt), TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Review.User.Should().NotBeNull();
        result.Value.Review.Trail.Should().NotBeNull();

        await using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var stored = await context.Reviews.SingleAsync(r => r.Id == Review1Id, TestContext.Current.CancellationToken);
        stored.TrailReview.Should().Be("Ändrad text");
        stored.Rating.Should().Be(2M);
        stored.LastUpdatedAt.Should().Be(updatedAt);
        stored.CreatedAt.Should().Be(Utilities.SeedDates.Created);
    }

    [Fact]
    public async Task UpdateReview_WithNothingChanged_KeepsTheUpdateTime()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new ReviewRepository(factory, NullLogger<ReviewRepository>.Instance);
        Review before;
        await using (var seeded = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken))
        {
            before = await seeded.Reviews.AsNoTracking().SingleAsync(r => r.Id == Review1Id, TestContext.Current.CancellationToken);
        }

        // Act
        var result = await repo.UpdateReviewAsync(new ReviewUpdate(Review1Id, before.TrailReview, before.Rating, [], [], MaxImages, new DateTime(2026, 11, 25, 12, 0, 0, DateTimeKind.Utc)), TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        await using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var stored = await context.Reviews.SingleAsync(r => r.Id == Review1Id, TestContext.Current.CancellationToken);
        stored.LastUpdatedAt.Should().Be(before.LastUpdatedAt);
    }

    [Fact]
    public async Task UpdateReview_WhenOnlyImagesChange_MovesTheUpdateTime()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new ReviewRepository(factory, NullLogger<ReviewRepository>.Instance);
        var updatedAt = new DateTime(2026, 11, 25, 12, 0, 0, DateTimeKind.Utc);
        Review before;
        await using (var seeded = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken))
        {
            before = await seeded.Reviews.AsNoTracking().SingleAsync(r => r.Id == Review1Id, TestContext.Current.CancellationToken);
        }

        // Act
        var result = await repo.UpdateReviewAsync(new ReviewUpdate(Review1Id, before.TrailReview, before.Rating, ["rev-img-1"], [], MaxImages, updatedAt), TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        await using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var stored = await context.Reviews.SingleAsync(r => r.Id == Review1Id, TestContext.Current.CancellationToken);
        stored.LastUpdatedAt.Should().Be(updatedAt);
    }

    [Fact]
    public async Task UpdateReview_RemovesAndAddsImages()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new ReviewRepository(factory, NullLogger<ReviewRepository>.Instance);

        // Act
        var result = await repo.UpdateReviewAsync(new ReviewUpdate(Review1Id, null, 4M, ["rev-img-1"], ["reviews/new.jpg"], MaxImages, DateTime.UtcNow), TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        await using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var urls = await context.ReviewImages.Where(i => i.ReviewId == Review1Id).Select(i => i.ImageUrl).ToListAsync(TestContext.Current.CancellationToken);
        urls.Should().BeEquivalentTo([Review1SecondImageUrl, "reviews/new.jpg"]);
    }

    [Fact]
    public async Task UpdateReview_ReturnsTheFilesOfTheRemovedImages()
    {
        // Arrange
        var repo = new ReviewRepository(CreateSeededFactory(), NullLogger<ReviewRepository>.Instance);

        // Act
        var result = await repo.UpdateReviewAsync(new ReviewUpdate(Review1Id, null, 4M, ["rev-img-1"], [], MaxImages, DateTime.UtcNow), TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.RemovedImageUrls.Should().BeEquivalentTo([Review1FirstImageUrl]);
    }

    [Fact]
    public async Task UpdateReview_PastTheImageLimit_ReturnsConflictAndSavesNothing()
    {
        // Arrange — Review1 already has two images
        var factory = CreateSeededFactory();
        var repo = new ReviewRepository(factory, NullLogger<ReviewRepository>.Instance);

        // Act
        var result = await repo.UpdateReviewAsync(new ReviewUpdate(Review1Id, "Ändrad", 4M, [], ["reviews/a.jpg", "reviews/b.jpg"], MaxImages, DateTime.UtcNow), TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.Conflict);

        await using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        (await context.ReviewImages.CountAsync(i => i.ReviewId == Review1Id, TestContext.Current.CancellationToken)).Should().Be(2);
        (await context.Reviews.SingleAsync(r => r.Id == Review1Id, TestContext.Current.CancellationToken)).TrailReview.Should().NotBe("Ändrad");
    }

    [Fact]
    public async Task UpdateReview_ReplacingUpToTheImageLimit_Succeeds()
    {
        // Arrange — Review1 already has two images
        var repo = new ReviewRepository(CreateSeededFactory(), NullLogger<ReviewRepository>.Instance);

        // Act
        var result = await repo.UpdateReviewAsync(new ReviewUpdate(Review1Id, null, 4M, ["rev-img-1"], ["reviews/a.jpg", "reviews/b.jpg"], MaxImages, DateTime.UtcNow), TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateReview_WhenTheReviewDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.UpdateReviewAsync(new ReviewUpdate(9999, null, 4M, [], [], MaxImages, DateTime.UtcNow), TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task UpdateReview_WhenTheReviewIsHidden_ReturnsNotFoundAndLeavesItUnchanged()
    {
        // Arrange
        var factory = CreateSeededFactory(context =>
            context.Reviews.Local.Single(r => r.Id == Review1Id).ModerationState = ModerationState.HiddenPendingReview);
        var repo = new ReviewRepository(factory, NullLogger<ReviewRepository>.Instance);

        // Act
        var result = await repo.UpdateReviewAsync(new ReviewUpdate(Review1Id, "Försöker kringgå", 4M, [], [], MaxImages, DateTime.UtcNow), TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);

        await using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var stored = await context.Reviews.IgnoreQueryFilters().SingleAsync(r => r.Id == Review1Id, TestContext.Current.CancellationToken);
        stored.TrailReview.Should().NotBe("Försöker kringgå");
        stored.ModerationState.Should().Be(ModerationState.HiddenPendingReview);
    }

    [Fact]
    public async Task DeleteReview_ShouldRemoveFromDatabase()
    {
        // Arrange
        var repo = new ReviewRepository(CreateSeededFactory(), NullLogger<ReviewRepository>.Instance);
        var found = await repo.GetReviewByIdentifierAsync(Review5Identifier, KattletenIdentifier, TestContext.Current.CancellationToken);
        found.IsSuccess.Should().BeTrue();

        // Act
        found.Value.Should().NotBeNull();
        var deleteResult = await repo.DeleteReviewAsync(found.Value, TestContext.Current.CancellationToken);

        // Assert
        deleteResult.IsSuccess.Should().BeTrue();

        var verify = await repo.GetReviewByIdentifierAsync(Review5Identifier, KattletenIdentifier, TestContext.Current.CancellationToken);
        verify.IsSuccess.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteAccount_ReturnsTheImageUrlsFromAllTheirReviews()
    {
        // Arrange — user 2 (VandrarVennen) wrote review 1, the only seeded review with images

        // Act
        var result = await DeleteAccountAsync(CreateSeededFactory(), VandrarVennenIdentifier);

        // Assert
        result.Value.Should().NotBeNull();
        result.Value.FileUrls.Should().BeEquivalentTo([
            "https://inkaben.se/stigvidd/mock/review-tiveden-1.jpg",
            "https://inkaben.se/stigvidd/mock/review-tiveden-2.jpg"]);
    }

    [Fact]
    public async Task DeleteAccount_WhenTheirReviewsHaveNoImages_ReturnsNoUrls()
    {
        // Arrange — user 1 has reviews, none of them with images

        // Act
        var result = await DeleteAccountAsync(CreateSeededFactory(), NaturElskarenIdentifier);

        // Assert
        result.Value.Should().NotBeNull();
        result.Value.FileUrls.Should().BeEmpty();
    }

    [Fact]
    public async Task HasUserReviewedTrail_WhenTheUserReviewedThatTrail_ReturnsTrue()
    {
        // Arrange — VandrarVennen (user 2) wrote Review 1 on Tiveden (trail 1)
        var repo = BuildRepo();

        // Act
        var result = await repo.HasUserReviewedTrailAsync(TivedenId, VandrarVennenId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeTrue();
    }

    [Fact]
    public async Task HasUserReviewedTrail_WhenTheUserReviewedAnotherTrail_ReturnsFalse()
    {
        // Arrange — trail 2 has a review, but from user 1
        var repo = BuildRepo();

        // Act
        var result = await repo.HasUserReviewedTrailAsync(OtherTrailWithReviewsId, VandrarVennenId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeFalse();
    }

    [Fact]
    public async Task HasUserReviewedTrail_WhenSomeoneElseReviewedThatTrail_ReturnsFalse()
    {
        // Arrange — user 5 has no review on Tiveden, but others do
        var repo = BuildRepo();

        // Act
        var result = await repo.HasUserReviewedTrailAsync(TivedenId, UserWithoutTivedenReviewId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteAccount_KeepsTheRatingAndDropsTheReviewTextAndImages()
    {
        // Arrange — user 2 (VandrarVennen) wrote review 1, the only seeded review with images
        var factory = CreateSeededFactory();
        var repo = new ReviewRepository(factory, NullLogger<ReviewRepository>.Instance);
        var before = await repo.GetReviewByIdentifierAsync(Review1Identifier, VandrarVennenIdentifier, TestContext.Current.CancellationToken);
        before.Value.Should().NotBeNull();
        before.Value.TrailReview.Should().NotBeNull();
        before.Value.ReviewImages.Should().NotBeEmpty();

        // Act
        await DeleteAccountAsync(factory, VandrarVennenIdentifier);

        // Assert
        await using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var after = await context.Reviews
            .Include(r => r.ReviewImages)
            .SingleAsync(r => r.Identifier == Review1Identifier, TestContext.Current.CancellationToken);
        after.Rating.Should().Be(before.Value.Rating);
        after.TrailReview.Should().BeNull();
        after.ReviewImages.Should().BeNullOrEmpty();
    }

    [Fact]
    public async Task DeleteAccount_LeavesOtherUsersReviewsAlone()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new ReviewRepository(factory, NullLogger<ReviewRepository>.Instance);
        var before = await repo.GetReviewByIdentifierAsync(Review5Identifier, KattletenIdentifier, TestContext.Current.CancellationToken);

        // Act
        await DeleteAccountAsync(factory, VandrarVennenIdentifier);

        // Assert
        var after = await repo.GetReviewByIdentifierAsync(Review5Identifier, KattletenIdentifier, TestContext.Current.CancellationToken);
        after.IsSuccess.Should().BeTrue();
        after.Value.Should().NotBeNull();
        before.Value.Should().NotBeNull();
        after.Value.TrailReview.Should().Be(before.Value.TrailReview);
        after.Value.Rating.Should().Be(before.Value.Rating);
    }

    [Fact]
    public async Task GetReviewsByUserIdAsync_ListsOnlyTheUsersVisibleReviews()
    {
        var factory = CreateSeededFactory(db => db.Reviews.Add(new Review
        {
            Identifier = "hidden-review",
            Rating = 1m,
            TrailId = 3,
            UserId = 1,
            TrailReview = "Dold",
            ModerationState = Infrastructure.Enums.ModerationState.HiddenPendingReview,
        }));
        var repo = new ReviewRepository(factory, NullLogger<ReviewRepository>.Instance);

        var result = await repo.GetReviewsByUserIdAsync(1, r => r.Identifier, TestContext.Current.CancellationToken);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEquivalentTo(["r2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", "r6f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b"]);
    }

    [Fact]
    public async Task GetReviewsByUserIdAsync_LeavesOutReviewsOfTrailsNoLongerShown()
    {
        var factory = CreateSeededFactory(db => db.Trails.Local.Single(t => t.Id == 2).IsVerified = false);
        var repo = new ReviewRepository(factory, NullLogger<ReviewRepository>.Instance);

        var result = await repo.GetReviewsByUserIdAsync(1, r => r.Identifier, TestContext.Current.CancellationToken);

        result.Value.Should().Equal("r6f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b");
    }
}
