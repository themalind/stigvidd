// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.CityArea;

namespace Core.Validators.CityAreas;

public class SaveCityAreaBoundaryRequestValidator : AbstractValidator<SaveCityAreaBoundaryRequest>
{
    public const int MaxPolygons = 50;
    public const int MaxPositions = 20_000;

    public SaveCityAreaBoundaryRequestValidator()
    {
        RuleFor(r => r.Coordinates)
            .NotNull()
            .NotEmpty().WithMessage("Draw the boundary first.")
            .Must(polygons => polygons.Count <= MaxPolygons).WithMessage($"A boundary has at most {MaxPolygons} parts.")
            .Must(polygons => polygons.Sum(p => p.Sum(ring => ring.Count)) <= MaxPositions)
            .WithMessage($"The boundary has too many points; keep it under {MaxPositions}.");

        RuleForEach(r => r.Coordinates)
            .Must(polygon => polygon.Count > 0).WithMessage("Each part needs an outer ring.")
            .Must(polygon => polygon.All(IsRing)).WithMessage("Each ring needs at least four positions and must end where it starts.")
            .Must(polygon => polygon.All(ring => ring.All(IsPosition))).WithMessage("Each position is a [longitude, latitude] pair within range.");
    }

    private static bool IsRing(List<List<double>> ring)
    {
        if (ring.Count < 4 || !ring.All(p => p.Count == 2))
            return false;

        return ring[0][0] == ring[^1][0] && ring[0][1] == ring[^1][1];
    }

    private static bool IsPosition(List<double> position)
    {
        return position.Count == 2
            && double.IsFinite(position[0]) && position[0] is >= -180 and <= 180
            && double.IsFinite(position[1]) && position[1] is >= -90 and <= 90;
    }
}
