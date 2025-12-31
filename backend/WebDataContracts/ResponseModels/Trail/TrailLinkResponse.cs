namespace WebDataContracts.ResponseModels.Trail;

public class TrailLinkResponse
{
    public required string Identifier { get; set; }
    public required string Link { get; set; }
 
    public static TrailLinkResponse Create(string identifier, string link)
    {
        return new TrailLinkResponse
        {
            Identifier = identifier,
            Link = link,
        };
    }
}

