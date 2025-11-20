namespace Infrastructure.Data.Entities;

public class ReviewImage
{
    public int Id { get; set; }
    public string? ImageUrl { get; set; }
    public int ReviewId { get; set; }

    public Review? Review { get; set; }
}
