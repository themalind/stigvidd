namespace WebDataContracts.RequestModels.Hike;

public class UpdateHikeRequest
{
    public string? Name { get; set; }
    public string? ParkingInfo { get; set; }
    public string? GettingThere { get; set; }
    public string? Description { get; set; }
}
