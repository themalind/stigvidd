using WebDataContracts.ResponseModels;

namespace WebDataContracts.ViewModels;

public class TrailOverviewViewModel
{
    public required string Identifier { get; set; }
    public string? Name { get; set; }
    public double TrailLength { get; set; }
    public IReadOnlyCollection<TrailImageDTO>? TrailImageDTOs { get; set; }

    public static TrailOverviewViewModel Create(
        string identifier,
        string? name,
        double trailLength,
        IEnumerable<TrailImageDTO>? trailImageDTOs)
    {
        return new TrailOverviewViewModel
        {
            Identifier = identifier,
            Name = name,
            TrailLength = trailLength,
            TrailImageDTOs = trailImageDTOs?.ToList(),
        };
    }
}

