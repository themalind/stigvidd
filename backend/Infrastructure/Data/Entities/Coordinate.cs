namespace Infrastructure.Data.Entities;

public class Coordinate
{
    public int Id { get; set; }
    public string[]? Coordinates { get; set; }
    public int TrailId { get; set; }
    public Trail? Trail { get; set; }
}

