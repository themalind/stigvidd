// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.TrailImport.Apply;

public readonly record struct MergeResult<T>(MergeOutcome Outcome, T Value)
{
    public bool ShouldWrite => Outcome == MergeOutcome.TookSource;
}
