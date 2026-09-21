// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Media;

public static class MediaOwnerTypes
{
    public const string Trail = "Trail";
    public const string Facility = "Facility";
    public const string TrailSymbol = "TrailSymbol";

    public static readonly IReadOnlyList<string> All = [Trail, Facility, TrailSymbol];

    // keep-comment: the filter is accepted in any casing, so nothing may compare MediaFilter.OwnerType directly - null means absent OR unrecognised, and the two are told apart by whether the input was empty
    public static string? Canonical(string? value)
    {
        var trimmed = value?.Trim();

        if (string.IsNullOrEmpty(trimmed))
            return null;

        return All.FirstOrDefault(known => string.Equals(known, trimmed, StringComparison.OrdinalIgnoreCase));
    }

    public static bool IsKnown(string? value) =>
        string.IsNullOrWhiteSpace(value) || Canonical(value) is not null;
}
