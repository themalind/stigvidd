namespace WebDataContracts.RequestModels.Hike;

public class CreateHikeRequest
{
    public required string Name { get; set; }
    public decimal HikeLength { get; set; }
    public int Duration { get; set; }
    public required string Coordinates { get; set; }
    public string? ParkingInfo { get; set; }
    public string? GettingThere { get; set; }
    public string? Description { get; set; }
}