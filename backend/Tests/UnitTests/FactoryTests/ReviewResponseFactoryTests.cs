using Core.Factories;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using Moq;

namespace UnitTests.FactoryTests;

public class ReviewResponseFactoryTests
{
    private static ReviewResponseFactory BuildFactory()
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");

        return new ReviewResponseFactory(cfg.Object);
    }

    private static Review BaseReview() => new()
    {
        Id = 1,
        Identifier = "test-review-id",
        TrailReview = "Great trail",
        Rating = 4.0M,
        CreatedAt = DateTime.UtcNow,
        User = new User { Id = 1, Identifier = "user-id", NickName = "Nick", Email = "nick@test.com", SubjectId = "uid" },
        Trail = new Trail { Id = 1, Identifier = "trail-id", Name = "Test Trail", TrailLength = 5M },
        ReviewImages = []
    };

    [Fact]
    public void Create_WhenReviewHasImages_ImageUrlsHaveBaseUrlPrepended()
    {
        // Arrange
        var factory = BuildFactory();
        var review = BaseReview();
        review.ReviewImages =
        [
            new ReviewImage { Identifier = "img-1", ImageUrl = "reviews/img1.jpg", ReviewId = 1 },
            new ReviewImage { Identifier = "img-2", ImageUrl = "reviews/img2.jpg", ReviewId = 1 }
        ];

        // Act
        var result = factory.Create(review);

        // Assert
        result.ReviewImages.Should().HaveCount(2);
        result.ReviewImages.Should().NotBeNull();
        result.ReviewImages.Should().AllSatisfy(img =>
            img.ImageUrl.Should().StartWith("http://stigvidd.se/testing/"));
        result.ReviewImages.Select(i => i.ImageUrl).Should().BeEquivalentTo(
            ["http://stigvidd.se/testing/reviews/img1.jpg", "http://stigvidd.se/testing/reviews/img2.jpg"]);
    }

    [Fact]
    public void Create_WhenReviewHasNoImages_ReturnsEmptyImages()
    {
        // Arrange
        var factory = BuildFactory();
        var review = BaseReview();
        review.ReviewImages = [];

        // Act
        var result = factory.Create(review);

        // Assert
        result.ReviewImages.Should().BeEmpty();
    }
}
