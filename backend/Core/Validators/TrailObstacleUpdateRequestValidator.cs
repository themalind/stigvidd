using FluentValidation;
using WebDataContracts.RequestModels.TrailObstacle;

namespace Core.Validators
{
    public class TrailObstacleUpdateRequestValidator : AbstractValidator<TrailObstacleUpdateRequest>
    {
        public TrailObstacleUpdateRequestValidator()
        {
            RuleFor(trailObstacleRequest => trailObstacleRequest.Description)
                 .NotEmpty()
                 .WithMessage("Description can not be empty")
                 .MinimumLength(15)
                 .MaximumLength(500)
                 .When(x => x.Description != null);
            RuleFor(trailObstacleRequest => trailObstacleRequest.IssueType)
                .NotEmpty()
                .WithMessage("IssueType can not be empty")
                .When(x => x.IssueType != null);
        }
    }
}
