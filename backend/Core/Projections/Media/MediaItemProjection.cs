// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Projections.Media;

public record MediaItemProjection(
    // keep-comment: the sort tiebreak, and the per-source cap key. It is the row's int Id, not its Identifier, so that pushing the ordering into SQL later stays safe: a string tiebreak would then be compared under the database collation on one side and Ordinal on the other, and the two disagree on a GUID's hyphens under en_US.utf8
    int SourceId,
    string Identifier,
    string ImageUrl,
    string? AltText,
    string? Caption,
    int Width,
    int Height,
    long SizeBytes,
    DateTime CreatedAt,
    string OwnerType,
    string? OwnerIdentifier,
    string? OwnerName);
