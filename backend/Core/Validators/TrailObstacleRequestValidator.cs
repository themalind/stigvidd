using FluentValidation;
using WebDataContracts.RequestModels.TrailObstacle;

namespace Core.Validators;

public class TrailObstacleRequestValidator : AbstractValidator<TrailObstacleRequest>
{
    public TrailObstacleRequestValidator()
    {
        RuleFor(trailObstacleRequest => trailObstacleRequest.Description)
            .NotEmpty()
            .WithMessage("Description can not be empty")
            .MinimumLength(15)
            .MaximumLength(500);
        RuleFor(trailObstacleRequest => trailObstacleRequest.IssueType)
            .NotEmpty()
            .WithMessage("IssueType can not be empty");
        RuleFor(trailObstacleRequest => trailObstacleRequest.TrailObstacleIdentifier)
            .NotEmpty().WithMessage("TrailObstacleIdentifier is required.")
            .Length(36).WithMessage("TrailObstacleIdentifier must be at least 36 characters long.");
        RuleFor(trailObstacleRequest => trailObstacleRequest.Longitude)
            .InclusiveBetween(-180, 180).WithMessage("Longitude must be between -180 and 180.")
            .When(x => x.Longitude.HasValue);
        RuleFor(trailObstacleRequest => trailObstacleRequest.Latitude)
            .InclusiveBetween(-90, 90).WithMessage("Latitude must be between -90 and 90.")
            .When(x => x.Latitude.HasValue);
    }
}
