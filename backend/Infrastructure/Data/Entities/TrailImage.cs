namespace Infrastructure.Data.Entities;

public class TrailImage
{
    public int Id { get; set; }
    public string? ImageUrl { get; set; }
    public int TrailId { get; set; }

    public Trail? Trail { get; set; }
}
