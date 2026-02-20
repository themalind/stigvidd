using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Factories;

public class TrailResponseFactory
{
    private string _presentableBaseUrl;

    public TrailResponseFactory(IConfiguration configuration)
    {
        _presentableBaseUrl = configuration["PresentableBaseUrl"] ?? throw new InvalidOperationException("PresentableBaseUrl configuration is missing");
    }

    public TrailResponse Create(Trail trail)
    {
        var images = trail.TrailImages?.Select(trailImage =>
            TrailImageResponse.Create(
                trailImage.Identifier,
                trailImage.ImageUrl)) ?? null;

        var links = trail.TrailLinks?.Select(trailLink =>
            TrailLinkResponse.Create( // Här kommer vi behöva skicka presentableUrl
                trailLink.Identifier,
                trailLink.Link,
                trailLink.Title)) ?? null;

        var visitorInformation = trail.VisitorInformation != null
            ? VisitorInformationResponse.Create(
                trail.VisitorInformation.Identifier,
                trail.VisitorInformation.GettingThere,
                trail.VisitorInformation.PublicTransport,
                trail.VisitorInformation.Parking,
                trail.VisitorInformation.Illumination,
                trail.VisitorInformation.IlluminationText,
                trail.VisitorInformation.MaintainedBy,
                trail.VisitorInformation.WinterMaintenance)
            : null;

        return TrailResponse.Create
        (trail.Identifier,
        trail.Name,
        trail.TrailLength,
        trail.Classification,
        trail.Accessibility,
        trail.AccessibilityInfo ?? string.Empty,
        trail.TrailSymbol ?? string.Empty,
        trail.TrailSymbolImage ?? string.Empty,
        trail.Description ?? string.Empty,
        trail.FullDescription ?? string.Empty,
        trail.Coordinates ?? string.Empty,
        trail.Tags ?? string.Empty,
        trail.CreatedBy ?? string.Empty,
        trail.IsVerified,
        trail.City ?? string.Empty,
        images,
        links,
        visitorInformation);
    }
}
