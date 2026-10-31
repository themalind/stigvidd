// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using NetTopologySuite.Geometries;

namespace Core.Services.Events;

public static class EventRouteCopy
{
    // Far below phone GPS error, so the copy serves the follow view as well as the full path would. keep-comment: why one simplified path is enough
    public const double ToleranceMetres = 2.0;
    public const int MaxPoints = 2000;

    public static Result<EventRoute> FromHike(LineString hikePath, int? trimStartIndex, int? trimEndIndex)
    {
        var trimmed = PathTrim.Trim(hikePath, trimStartIndex, trimEndIndex);

        if (trimmed is null)
            return Result.Fail<EventRoute>(new Message(400, "The trim indexes do not leave a path."));

        var path = PathSimplifier.Simplify(trimmed, ToleranceMetres);

        if (path.NumPoints > MaxPoints)
            return Result.Fail<EventRoute>(new Message(400, "The route is too long for an event. Trim it and try again."));

        return Result.Ok(new EventRoute
        {
            Path = path,
            LengthMetres = (int)Math.Round(PathMetrics.LengthMetres(path)),
        });
    }
}
