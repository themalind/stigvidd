// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.TrailImport.Apply;

public enum MergeOutcome
{
    NoBaseline,  // keep-comment: no previous snapshot; nothing is written on an existing trail
    Unchanged,   // keep-comment: ours and the source already agree
    TookSource,  // keep-comment: we had not edited the field, so the source's new value wins
    KeptOurs,    // keep-comment: the source did not change, so our edit stands
    Conflict,    // keep-comment: both changed; ours stands and the difference is reported
}
