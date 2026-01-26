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
        var images = review.ReviewImages?.Select(ri =>
            ReviewImageResponse.Create(
                _presentableBaseUrl, // "https://stigvidd.se/files/"
                ri.Identifier,
                ri.ImageUrl)) ?? null; // reviews/guid.jpeg
        return ReviewResponse.Create(
            review.Identifier,
            review.TrailReview ?? string.Empty,
            review.Grade,
            review.User!.NickName,
            review.CreatedAt,
            review.Trail!.Identifier,
            review.User.Identifier,
            images);
    }
}
