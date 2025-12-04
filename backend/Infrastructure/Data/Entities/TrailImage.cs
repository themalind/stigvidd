namespace Infrastructure.Data.Entities;

public class TrailImage
{
    public int Id { get; set; }
    public string Identifier { get; set; } = Guid.NewGuid().ToString();
    public string? ImageUrl { get; set; }
    public int TrailId { get; set; } = 0;
    public Trail? Trail { get; set; }
}
