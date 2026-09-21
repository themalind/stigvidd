// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Media;

public static class MediaFormats
{
    // keep-comment: what the library may hold and can therefore be filtered for, which is wider than what a reprocess can produce
    public static readonly IReadOnlyList<string> Filterable = ["jpeg", "jpg", "webp", "png", "gif"];

    // keep-comment: exactly the cases ImageProcessingOptionsMapper switches on - anything else falls through to Original there, which is a job that does nothing and still reports Succeeded
    public static readonly IReadOnlyList<string> Output = ["original", "jpeg", "jpg", "webp", "png"];

    // keep-comment: MediaFilter.TargetFormat asks "what would a reprocess to this change", so it is Output without "original" - accepting a format no reprocess can produce would let the browse page count images for a batch the reprocess endpoint then refuses
    public static readonly IReadOnlyList<string> ReprocessTarget = ["jpeg", "jpg", "webp", "png"];

    public static bool IsOneOf(IReadOnlyList<string> allowed, string? value) =>
        string.IsNullOrWhiteSpace(value)
        || allowed.Contains(value.Trim(), StringComparer.OrdinalIgnoreCase);

    public static string Describe(IReadOnlyList<string> allowed) => string.Join(", ", allowed);
}
