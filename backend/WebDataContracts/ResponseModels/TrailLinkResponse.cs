namespace WebDataContracts.ResponseModels;

public class TrailLinkResponse
{
    public required string Identifier { get; set; }
    public required string Link { get; set; }
    public required string TrailIdentifier { get; set; }

    public static TrailLinkResponse Create(string identifier, string link, string trailIdentifier)
    {
        return new TrailLinkResponse
        {
            Identifier = identifier,
            Link = link,
            TrailIdentifier = trailIdentifier
        };
    }
}

