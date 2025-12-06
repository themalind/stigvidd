namespace WebDataContracts.ResponseModels;

public class ReviewDTO
{
    public required string Identifier { get; set; }
    public string? TrailReview { get; set; }
    public float Grade { get; set; }
    public required string UserName { get; set; }
    public DateTime CreatedAt { get; set; }
    public required string UserIdentifier { get; set; }
    public required string TrailIdentifier { get; set; }
    public IReadOnlyCollection<ReviewImageDTO>? ReviewImageDTOs { get; set; }

    public static ReviewDTO Create(
        string identifier,
        string? trailReview,
        float grade,
        string username,
        DateTime createdAt,
        string trailIdentifier,
        string userIdentifier,
        IEnumerable<ReviewImageDTO>? imageDTOs)
    {
        return new ReviewDTO
        {
            Identifier = identifier,
            TrailReview = trailReview,
            Grade = grade,
            UserName = username,
            CreatedAt = createdAt,
            TrailIdentifier = trailIdentifier,
            UserIdentifier = userIdentifier,
            ReviewImageDTOs = imageDTOs?.ToList(),
        };
    }

}

