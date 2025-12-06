namespace Infrastructure.Data.Entities;

public class TrailImage : BaseEntity
{
    public required string ImageUrl { get; set; }
    public int TrailId { get; set; } 

    public Trail? Trail { get; set; }
}
