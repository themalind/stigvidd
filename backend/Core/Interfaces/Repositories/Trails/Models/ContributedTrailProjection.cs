// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Trails.Models;

public record ContributedTrailProjection(
    string Identifier, string Name, decimal TrailLength, string City, string? ImageUrl, DateTime PublishedAt);
