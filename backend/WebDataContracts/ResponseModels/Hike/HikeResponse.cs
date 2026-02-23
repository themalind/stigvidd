namespace WebDataContracts.ResponseModels.Hike;

public class HikeResponse
{
    public required string Identifier { get; set; }
    public string? Name { get; set; }
    public decimal HikeLength { get; set; }
    public int Duration { get; set; }
    public string? Coordinates { get; set; }
    public string? CreatedBy { get; set; }

    public static HikeResponse Create(
        string identifier,
        string name,
        decimal hikeLength,
        int duration,
        string coordinates,
        string createdBy)
    {
        return new HikeResponse
        {
            Identifier = identifier,
            Name = name,
            HikeLength = hikeLength,
            Duration = duration,
            Coordinates = coordinates,
            CreatedBy = createdBy
        };
    }
}