namespace Infrastructure.Data.Entities;

public class Review
{
    public int Id { get; set; }
    public string? TrailReview { get; set; }
    public float Grade { get; set; }
    public int TrailId { get; set; }
    public int UserId { get; set; }

    public Trail? Trail { get; set; }
    public User? User { get; set; }
}

