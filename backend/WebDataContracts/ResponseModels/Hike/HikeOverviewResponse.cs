namespace WebDataContracts.ResponseModels.Hike;

public class HikeOverviewResponse
{
    public required string Identifier { get; set; }
    public string? Name { get; set; }
    public decimal HikeLength { get; set; }
    public int Duration { get; set; }
    public string? Coordinates { get; set; }
    public string? CreatedBy { get; set; }
    public string? GettingThere { get; set; }
    public string? ParkingInfo { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }

    public static HikeOverviewResponse Create(
        string identifier,
        string name,
        decimal hikeLength,
        int duration,
        string coordinates,
        string createdBy,
        string? gettingThere,
        string? parkingInfo,
        string? description,
        DateTime createdAt)
    {
        return new HikeOverviewResponse
        {
            Identifier = identifier,
            Name = name,
            HikeLength = hikeLength,
            Duration = duration,
            Coordinates = coordinates,
            CreatedBy = createdBy,
            GettingThere = gettingThere,
            ParkingInfo = parkingInfo,
            Description = description,
            CreatedAt = createdAt
        };
    }
}