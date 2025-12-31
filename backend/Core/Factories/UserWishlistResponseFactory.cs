using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Review;
using WebDataContracts.ResponseModels.Trail;
using WebDataContracts.ResponseModels.User;

namespace Core.Factories;

public class UserWishlistResponseFactory
{
    public IEnumerable<UserWishlistTrailCollectionResponse>? Create(ICollection<Trail>? trails)
    {
        return trails?.Select(
                trail => UserWishlistTrailCollectionResponse.Create(
                trail.Identifier,
                trail.Name,
                trail.TrailLength,
                trail.Description,
                trail.Reviews?.Select(r => RatingResponse.Create(
                     r.Identifier,
                     r.Grade)).ToList(),
                trail.TrailImages?
                    .Select(trailImage => TrailImageResponse.Create(
                        trailImage.Identifier,
                        trailImage.ImageUrl))
                    .ToList()
            .ToList()));
    }

    public UserWishlistTrailCollectionResponse Create(Trail trail)
    {
        return UserWishlistTrailCollectionResponse.Create(
            trail.Identifier,
            trail.Name,
            trail.TrailLength,
            trail.Description,
            trail.Reviews?
                .Select(r => RatingResponse.Create(
                    r.Identifier,
                    r.Grade))
                .ToList(),
            trail.TrailImages?
                .Select(trailImage => TrailImageResponse.Create(
                    trailImage.Identifier,
                    trailImage.ImageUrl))
                .ToList()
        );
    }
}
