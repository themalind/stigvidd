using System.Linq.Expressions;
using Core;
using Core.Repositories;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using WebDataContracts.ResponseModels.Review;

namespace UnitTests.RepositoryTests;

public class ReviewRepositoryTests : TestBase
{
    private const string NassehultIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c"; // 2 reviews
    private const string HultaforsIdentifier = "66f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b"; // 0 reviews
    private const string Review1Identifier = "r1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // VandrarVennen, Tiveden, with images
    private const string Review5Identifier = "r5e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a"; // Kattleten, no images
    private const string VandrarVennenIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
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

    private ReviewRepository BuildRepo() => new(CreateSeededFactory(), NullLogger<ReviewRepository>.Instance);

    [Fact]
    public async Task GetReviewsByTrailIdentifier_WhenTrailHasReviews_ReturnsCorrectCount()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.GetReviewsByTrailIdentifierAsync(NassehultIdentifier, 0, 10, ReviewSelector, CancellationToken.None);

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
        var result = await repo.GetReviewsByTrailIdentifierAsync(HultaforsIdentifier, 0, 10, ReviewSelector, CancellationToken.None);

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
        var result = await repo.GetReviewsByTrailIdentifierAsync(NassehultIdentifier, 0, 1, ReviewSelector, CancellationToken.None);

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
        var result = await repo.GetReviewsByTrailIdentifierAsync(NassehultIdentifier, 1, 1, ReviewSelector, CancellationToken.None);

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
        var result = await repo.GetReviewsByTrailIdentifierAsync(NassehultIdentifier, 10, 10, ReviewSelector, CancellationToken.None);

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
        var result = await repo.GetReviewByIdentifierAsync(Review1Identifier, VandrarVennenIdentifier, CancellationToken.None);

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
        // Review1 belongs to VandrarVennen, not Kattleten
        var result = await repo.GetReviewByIdentifierAsync(Review1Identifier, KattletenIdentifier, CancellationToken.None);

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
        var result = await repo.GetReviewByIdentifierAsync("no-such-review", VandrarVennenIdentifier, CancellationToken.None);

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
        var result = await repo.AddReviewAsync(review, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Rating.Should().Be(4.5M);
    }

    [Fact]
    public async Task DeleteReview_ShouldRemoveFromDatabase()
    {
        // Arrange
        var repo = new ReviewRepository(CreateSeededFactory(), NullLogger<ReviewRepository>.Instance);
        var found = await repo.GetReviewByIdentifierAsync(Review5Identifier, KattletenIdentifier, CancellationToken.None);
        found.IsSuccess.Should().BeTrue();

        // Act
        found.Value.Should().NotBeNull();
        var deleteResult = await repo.DeleteReviewAsync(found.Value, CancellationToken.None);

        // Assert
        deleteResult.IsSuccess.Should().BeTrue();

        var verify = await repo.GetReviewByIdentifierAsync(Review5Identifier, KattletenIdentifier, CancellationToken.None);
        verify.IsSuccess.Should().BeFalse();
    }
}
