namespace WebDataContracts.RequestModels.CityArea;

public class CreateCityAreaRequest
{
    public required string Name { get; set; }
    public required string Location { get; set; }
    public string? Description { get; set; }
    public string? Url { get; set; }
}
