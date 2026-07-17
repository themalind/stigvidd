using FluentValidation;
using WebDataContracts.RequestModels.Hike;

namespace Core.Validators.Hike;

public class CreateHikeRequestValidator : AbstractValidator<CreateHikeRequest>
{
    // Pre-parse guard on the raw coordinate JSON string. Sized to comfortably hold
    // the ~20,000-point ceiling enforced after parsing in HikeService, while
    // rejecting grossly oversized payloads before they are deserialized.
    private const int MaxCoordinatesLength = 2_000_000;

    public CreateHikeRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(40);

        RuleFor(x => x.HikeLength)
            .GreaterThan(0)
            .LessThan(decimal.MaxValue);

        RuleFor(x => x.Duration)
            .GreaterThan(0);

        RuleFor(x => x.Coordinates)
            .NotEmpty()
            .MaximumLength(MaxCoordinatesLength);

        RuleFor(x => x.ParkingInfo)
            .NotEmpty()
            .MaximumLength(200)
            .When(x => x.ParkingInfo != null);

        RuleFor(x => x.GettingThere)
            .NotEmpty()
            .MaximumLength(200)
            .When(x => x.GettingThere != null);

        RuleFor(x => x.Description)
            .NotEmpty()
            .MaximumLength(500)
            .When(x => x.Description != null);
    }
}
