// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Projections.Trails;

// keep-comment: a class with setters, not a record, so EF can inline it into the selector that follows
public class AdminTrailSource
{
    public required Trail Trail { get; init; }
    public string? SubmissionIdentifier { get; init; }
}
