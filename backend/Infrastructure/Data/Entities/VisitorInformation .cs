namespace Infrastructure.Data.Entities;

public class VisitorInformation :BaseEntity
{
    public string GettingThere { get; set; } = string.Empty;
    public string PublicTransport { get; set; } = string.Empty;
    public string Parking { get; set; } = string.Empty;
}
