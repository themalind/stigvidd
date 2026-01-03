using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Review;
using WebDataContracts.ResponseModels.Trail;
using WebDataContracts.ResponseModels.User;

namespace Core.Factories;

public class UserWishlistResponseFactory
{
    public IEnumerable<UserWishlistTrailResponse>? Create(ICollection<Trail>? trails)
    {
        return trails?.Select(
                trail => UserWishlistTrailResponse.Create(
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

    public UserWishlistTrailResponse Create(Trail trail)
    {
        return UserWishlistTrailResponse.Create(
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
