namespace Infrastructure.Data.Entities;

public class ReviewImage : BaseEntity
{
    public required string ImageUrl { get; set; }
    public int ReviewId { get; set; }

    public Review? Review { get; set; }
}
