// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Trails.Models;

public record ReviewUpdate(
    int ReviewId,
    string? TrailReview,
    decimal Rating,
    IReadOnlyCollection<string> RemovedImageIdentifiers,
    IReadOnlyCollection<string> AddedImageUrls,
    int MaxImages,
    DateTime UpdatedAt);
