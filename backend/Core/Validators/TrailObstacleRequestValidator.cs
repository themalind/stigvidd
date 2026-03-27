using FluentValidation;
using WebDataContracts.RequestModels.TrailObstacle;

namespace Core.Validators;

public class TrailObstacleRequestValidator : AbstractValidator<TrailObstacleRequest>
{
    public TrailObstacleRequestValidator()
    {
        RuleFor(trailObstacleRequest => trailObstacleRequest.Description)
            .NotEmpty()
            .WithMessage("Description can not be empty")            .MinimumLength(15)
            .MaximumLength(500);
        RuleFor(trailObstacleRequest => trailObstacleRequest.IssueType)
            .NotEmpty()
            .WithMessage("IssueType can not be empty");
        RuleFor(trailObstacleRequest => trailObstacleRequest.TrailIdentifier)
            .NotEmpty().WithMessage("TrailObstacleIdentifier is required.")
            .Length(36).WithMessage("TrailObstacleIdentifier must be at least 36 characters long.");
        RuleFor(trailObstacleRequest => trailObstacleRequest.IncidentLongitude)
            .InclusiveBetween(-180, 180).WithMessage("Longitude must be between -180 and 180.")
            .When(x => x.IncidentLongitude.HasValue);
        RuleFor(trailObstacleRequest => trailObstacleRequest.IncidentLatitude)
            .InclusiveBetween(-90, 90).WithMessage("Latitude must be between -90 and 90.")
            .When(x => x.IncidentLatitude.HasValue);
    }
}

// WGS84 standard:
//  - Longitude: -180 to +180 (west to east of the prime meridian)
//  - Latitude: -90 to +90 (south pole to north pole)
