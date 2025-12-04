namespace WebDataContracts.ResponseModels;

public class TrailLinkDTO
{
    public required string Identifier { get; set; }
    public string? Link { get; set; }
    public int TrailId { get; set; }

    public static TrailLinkDTO Create(string identifier, string? link, int trailId)
    {
        return new TrailLinkDTO
        {
            Identifier = identifier,
            Link = link,
            TrailId = trailId
        };
    }
}

