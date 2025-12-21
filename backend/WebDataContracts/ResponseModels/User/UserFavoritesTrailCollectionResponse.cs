using WebDataContracts.ResponseModels.Review;
using WebDataContracts.ResponseModels.Trail;

namespace WebDataContracts.ResponseModels.User;

public class UserFavoritesTrailCollectionResponse
{
    public required string Identifier { get; set; }
    public string Name { get; set; } = string.Empty;
    public double TrailLength { get; set; }
    public string Description { get; set; } = string.Empty;
    public IReadOnlyCollection<RatingResponse>? RatingResponse { get; set; }
    public IReadOnlyCollection<TrailImageResponse>? TrailImages { get; set; }

    public static UserFavoritesTrailCollectionResponse Create(
        string identifier,
        string? name,
        double trailLength,
        string? description,
        IEnumerable<RatingResponse>? ratingResponses,
        IEnumerable<TrailImageResponse>? trailImages
        )
    {
        return new UserFavoritesTrailCollectionResponse
        {
            Identifier = identifier,
            Name = name ?? string.Empty,
            TrailLength = trailLength,
            Description = description ?? string.Empty,
            RatingResponse = ratingResponses?.ToList(),
            TrailImages = trailImages?.ToList(),
        };
    }
}
