namespace WebDataContracts.ResponseModels.HikeShare;

public class HikeShareRecipientResponse
{
    public required string HikeIdentifier { get; set; }
    public required string HikeName { get; set; }
    public decimal HikeLength { get; set; }
    public int Duration { get; set; }
    public required string Coordinates { get; set; }
    public string? CreatedByName { get; set; }
    public string? SharedByName { get; set; }
    public string? SharedByIdentifier { get; set; }
    public DateTime SharedAt { get; set; }
    public string? GettingThere { get; set; }
    public string? ParkingInfo { get; set; }
    public string? Description { get; set; }

    public static HikeShareRecipientResponse Create(
        string hikeIdentifier,
        string hikeName,
        decimal hikeLength,
        int duration,
        string coordinates,
        string? createdByName,
        string? sharedByName,
        string? sharedByIdentifier,
        DateTime sharedAt,
        string? gettingThere,
        string? parkingInfo,
        string? description)
    {
        return new HikeShareRecipientResponse
        {
            HikeIdentifier = hikeIdentifier,
            HikeName = hikeName,
            HikeLength = hikeLength,
            Duration = duration,
            Coordinates = coordinates,
            CreatedByName = createdByName,
            SharedByName = sharedByName,
            SharedByIdentifier = sharedByIdentifier,
            SharedAt = sharedAt,
            GettingThere = gettingThere,
            ParkingInfo = parkingInfo,
            Description = description
        };
    }
}
