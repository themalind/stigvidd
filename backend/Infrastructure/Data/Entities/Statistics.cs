namespace Infrastructure.Data.Entities;

public class Statistics : BaseEntity
{
    public int TotalSteps { get; set; } = 0;
    public double TotalKilometers { get; set; } = 0;
    public int TotalWalkedTrails { get; set; } = 0;
    public int UserId { get; set; }

    public User? User { get; set; }
}

