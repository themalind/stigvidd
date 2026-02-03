using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using WebDataContracts.ResponseModels.Review;

namespace Core.Factories;

public class ReviewResponseFactory
{
    private string _presentableBaseUrl;

    public ReviewResponseFactory(IConfiguration configuration)
    {
        _presentableBaseUrl = configuration["PresentableBaseUrl"] ?? throw new InvalidOperationException("PresentableBaseUrl configuration is missing");
    }

    public ReviewResponse Create(Review review)
    {
        var images = review.ReviewImages?.Select(reviewImage =>
            ReviewImageResponse.Create(
                _presentableBaseUrl, // "https://stigvidd.se/files/"
                reviewImage.Identifier,
                reviewImage.ImageUrl)); // reviews/guid.jpeg
        return ReviewResponse.Create(
            review.Identifier,
            review.TrailReview ?? string.Empty,
            review.Rating,
            review.User!.NickName,
            review.CreatedAt,
            review.Trail!.Identifier,
            review.User.Identifier,
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


