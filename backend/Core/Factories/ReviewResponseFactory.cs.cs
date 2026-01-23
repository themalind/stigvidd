using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Review;

namespace Core.Factories;

public class ReviewResponseFactory
{
    public ReviewResponse Create(Review review)
    {
        var images = review.ReviewImages?.Select(ri =>
            ReviewImageResponse.Create(
                ri.Identifier,
                ri.ImageUrl)) ?? null;
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
