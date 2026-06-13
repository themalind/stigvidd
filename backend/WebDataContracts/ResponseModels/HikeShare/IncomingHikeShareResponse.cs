namespace WebDataContracts.ResponseModels.HikeShare;

public class IncomingHikeShareResponse
{
    public required string HikeIdentifier { get; set; }
    public required string HikeName { get; set; }
    public decimal HikeLength { get; set; }
    public int Duration { get; set; }
    public string? SharedByName { get; set; }
    public string? SharedByIdentifier { get; set; }
    public string? CreatedByName { get; set; }
    public DateTime SharedAt { get; set; }

    public static IncomingHikeShareResponse Create(
        string hikeIdentifier,
        string hikeName,
        decimal hikeLength,
        int duration,
        string? sharedByName,
        string? sharedByIdentifier,
        string? createdByName,
        DateTime sharedAt)
    {
        return new IncomingHikeShareResponse
        {
            HikeIdentifier = hikeIdentifier,
            HikeName = hikeName,
            HikeLength = hikeLength,
            Duration = duration,
            SharedByName = sharedByName,
            SharedByIdentifier = sharedByIdentifier,
            CreatedByName = createdByName,
            SharedAt = sharedAt
        };
    }
}