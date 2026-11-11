// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Reporting.Models;

// What a report on someone's content becomes when that author deletes their account. keep-comment: the rule differs per type
public enum AuthorDeletionOutcome
{
    // The author's text is erased first, so the report is moot. keep-comment: Restore is only safe after that erasure
    Restore,
    Expire,
    // The content outlives its author unchanged, so a moderator must still decide. keep-comment: why the report stays Pending
    KeepPending,
}
