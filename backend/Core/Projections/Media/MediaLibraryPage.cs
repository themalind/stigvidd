// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Projections.Media;

public record MediaLibraryPage(
    IReadOnlyCollection<MediaItemProjection> Items,
    int Page,
    bool HasMore,
    int TotalCount,
    int ReprocessableCount,
    long TotalSizeBytes);
