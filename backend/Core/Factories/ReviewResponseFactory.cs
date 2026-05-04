using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using WebDataContracts.ResponseModels.Review;

namespace Core.Factories;

public class ReviewResponseFactory
{
    public string PresentableBaseUrl { get; }

    public ReviewResponseFactory(IConfiguration configuration)
    {
        PresentableBaseUrl = configuration["PresentableBaseUrl"] ?? throw new InvalidOperationException("PresentableBaseUrl configuration is missing");
    }

    public ReviewResponse Create(Review review)
    {
        var images = review.ReviewImages?.Select(reviewImage =>
            ReviewImageResponse.Create(
                PresentableBaseUrl, // "https://stigvidd.se/files/"
                reviewImage.Identifier,
                reviewImage.ImageUrl)); // reviews/guid.jpeg

        return ReviewResponse.Create(
            review.Identifier,
            review.TrailReview ?? string.Empty,
            review.Rating,
            review.User?.NickName ?? string.Empty,
            review.CreatedAt,
            review.Trail?.Identifier ?? string.Empty,
            review.User?.Identifier ?? string.Empty,
            images);
    }

    public PagedReviewResponse Create(List<ReviewResponse> reviews, int page, bool hasMore, int total = 0)
    {
        return new PagedReviewResponse
        {
            Reviews = reviews ?? [],
            Page = page,
            HasMore = hasMore,
            Total = total
        };
    }
}


