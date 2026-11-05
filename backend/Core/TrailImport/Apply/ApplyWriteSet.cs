// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.TrailImport.Apply;

// keep-comment: everything one apply will write, worked out before the transaction opens
public record ApplyWriteSet(
    IReadOnlyList<TrailCreate> Creates,
    IReadOnlyList<TrailUpdate> Updates,
    IReadOnlyList<LinkWrite> Links,
    IReadOnlyList<ApplyConflict> Conflicts);
