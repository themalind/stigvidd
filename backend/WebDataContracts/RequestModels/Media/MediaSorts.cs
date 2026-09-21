// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Media;

public enum MediaSort
{
    Newest,
    Oldest,
    Largest,
    Widest
}

// keep-comment: one list, because the validator, the repository's ordering and the web's sort control are otherwise three independent copies of the same four strings and nothing compares them
public static class MediaSorts
{
    public static readonly IReadOnlyList<string> All = ["newest", "oldest", "largest", "widest"];

    public static MediaSort Parse(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        "oldest" => MediaSort.Oldest,
        "largest" => MediaSort.Largest,
        "widest" => MediaSort.Widest,
        _ => MediaSort.Newest
    };

    public static bool IsKnown(string? value) =>
        string.IsNullOrWhiteSpace(value)
        || All.Contains(value.Trim(), StringComparer.OrdinalIgnoreCase);
}
