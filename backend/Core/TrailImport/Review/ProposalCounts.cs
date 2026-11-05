// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.TrailImport.Review;

// keep-comment: drives the summary row above the review list and answers whether the session is ready to apply
public sealed record ProposalCounts(
    int Total,
    int Certain,
    int High,
    int Medium,
    int Unmatched,
    int Pending,
    int Accepted,
    int Relinked,
    int CreateNew,
    int Excluded,
    int Skipped);
