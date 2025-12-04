namespace WebDataContracts.ResponseModels;
public class ReviewDTO
{
    public required string Identifier { get; set; }
    public string? TrailReview { get; set; }
    public float Grade { get; set; }
    public int TrailId { get; set; }
    public int UserId { get; set; }
    public IReadOnlyCollection<ReviewImageDTO>? ReviewImageDTOs { get; set; }


    public static ReviewDTO Create(
        string identifier,
        string? trailReview,
        float grade,
        int trailId,
        int userId,
        IEnumerable<ReviewImageDTO>? imageDTOs)
    {
        return new ReviewDTO
        {
            Identifier = identifier,
            TrailReview = trailReview,
            Grade = grade,
            TrailId = trailId,
            UserId = userId,
            ReviewImageDTOs = imageDTOs?.ToList(),
        };
    }

}

