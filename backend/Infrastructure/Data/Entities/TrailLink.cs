namespace Infrastructure.Data.Entities;

public class TrailLink
{
    public int Id { get; set; }
    public string? Link { get; set; }
    public int TrailId { get; set; }

    public Trail? Trail { get; set; }
}


