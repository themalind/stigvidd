
namespace WebDataContracts.ResponseModels.Trail;

public class CoordinatesResponse
{
    public required string Coordinates { get; set; }

    public static CoordinatesResponse Create(string coordinates)
    {
        return new CoordinatesResponse
        {
            Coordinates = coordinates
        };
    }
}
