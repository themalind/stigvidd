namespace WebDataContracts.ResponseModels.Review;

public class RatingResponse
{
    public required string Identifier { get; set; }
    public double Rating { get; set; }

    public static RatingResponse Create(
        string identifier,
        double rating)
    {
        return new RatingResponse
        {
            Identifier = identifier,
            Rating = rating,
        };
    }
}
