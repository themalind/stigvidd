namespace WebDataContracts.ResponseModels;

public class TrailLinkDTO
{
    public required string Identifier { get; set; }
    public required string Link { get; set; }
    public required string TrailIdentifier { get; set; }

    public static TrailLinkDTO Create(string identifier, string link, string trailIdentifier)
    {
        return new TrailLinkDTO
        {
            Identifier = identifier,
            Link = link,
            TrailIdentifier = trailIdentifier
        };
    }
}

