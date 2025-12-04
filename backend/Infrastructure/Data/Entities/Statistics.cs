namespace Infrastructure.Data.Entities;

public class Statistics
{
    public int Id { get; set; }
    public string Identifier { get; set; } = Guid.NewGuid().ToString();
    public int TotalSteps { get; set; } = 0;
    public double TotalKilometers { get; set; } = 0;
    public int TotalWalkedTrails { get; set; } = 0;
    public int UserId { get; set; }
    public User? User { get; set; }
}

