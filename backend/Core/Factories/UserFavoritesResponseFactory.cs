using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Review;
using WebDataContracts.ResponseModels.Trail;
using WebDataContracts.ResponseModels.User;

namespace Core.Factories;

public class UserFavoritesResponseFactory
{
    public IEnumerable<UserFavoritesTrailResponse>? Create(ICollection<Trail>? trails)
    {
        return trails?.Select(
                trail => UserFavoritesTrailResponse.Create(
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

    public UserFavoritesTrailResponse Create(Trail trail)
    {
        return UserFavoritesTrailResponse.Create(
            trail.Identifier,
            trail.Name,
            trail.TrailLength,
            trail.Description,
            trail.Reviews?
                .Select(rating => RatingResponse.Create(
                    rating.Identifier,
                    rating.Grade))
                .ToList(),
            trail.TrailImages?
                .Select(trailImage => TrailImageResponse.Create(
                    trailImage.Identifier,
                    trailImage.ImageUrl))
                .ToList()
        );
    }
}