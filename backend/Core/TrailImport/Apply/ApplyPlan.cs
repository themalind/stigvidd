// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.TrailImport.Apply;

public record ApplyPlan(
    IReadOnlyList<ApplyPlanRow> Rows,
    IReadOnlySet<int> TrailsWithExistingSegment,
    // keep-comment: without a link there is no snapshot to merge against, so no source-owned field may be written
    IReadOnlySet<int> TrailsWithBaseline);
