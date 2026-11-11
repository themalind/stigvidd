// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Account.Models;

// keep-comment: all ordinary outcomes; a failed Result means the attempt could not be evaluated at all
public enum EmailVerificationOutcome
{
    Verified,

    // keep-comment: success on purpose, since mail scanners follow the link before the human does
    AlreadyVerified,

    Expired,

    // keep-comment: no such token, or the wrong code for this address
    Invalid,

    // keep-comment: the challenge is dead and a resend is needed
    TooManyAttempts,
}
