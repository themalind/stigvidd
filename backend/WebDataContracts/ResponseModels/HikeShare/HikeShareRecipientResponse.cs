namespace WebDataContracts.ResponseModels.HikeShare;

public class HikeShareRecipientResponse
{
    public required string HikeIdentifier { get; set; }
    public required string HikeName { get; set; }
    public decimal Hikelength { get; set; }
    public int Duration { get; set; }
    public required string Coordinates { get; set; }
    public string? CreatedByName { get; set; }
    public string? SharedByName { get; set; }
    public string? SharedByIdentifier { get; set; }
    public DateTime SharedAt { get; set; }
}
