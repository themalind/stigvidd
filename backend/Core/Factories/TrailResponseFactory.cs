using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Review;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Factories;

public class TrailResponseFactory
{
    public TrailResponse Create(Trail trail)
    {
        var images = trail.TrailImages?.Select(ti =>
            TrailImageResponse.Create(
                ti.Identifier,
                ti.ImageUrl)) ?? null;

        var links = trail.TrailLinks?.Select(tl =>
            TrailLinkResponse.Create(
                tl.Identifier,
                tl.Link)) ?? null;

        var reviews = trail.Reviews?.Select(r =>
            ReviewResponse.Create(
                r.Identifier,
                r.TrailReview ?? string.Empty,
                r.Grade,
                r.User!.NickName,
                r.CreatedAt,
                trail.Identifier,
                r.User.Identifier,
                r.ReviewImages?.Select(ri =>
                    ReviewImageResponse.Create(
                        ri.Identifier,
                        ri.ImageUrl)))) ?? null;

        return TrailResponse.Create
        (trail.Identifier,
        trail.Name,
        trail.TrailLength,
        trail.Classification ?? string.Empty,
        trail.Accessability,
        trail.AccessabilityInfo ?? string.Empty,
        trail.TrailSymbol ?? string.Empty,
        trail.TrailSymbolImage ?? string.Empty,
        trail.Description ?? string.Empty,
        trail.CoordinatesJson ?? string.Empty,
        images,
        links,
        reviews
        );
    }
}
