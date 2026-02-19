using Core.Enums;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using WebDataContracts.ResponseModels.Review;
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
            TrailLinkResponse.Create(
                trailLink.Identifier,
                trailLink.Link)) ?? null;

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
        links);
    }
}
