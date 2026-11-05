// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services;

// keep-comment: all ordinary outcomes; a failed Result means the attempt could not be evaluated at all
public enum PasswordResetOutcome
{
    // keep-comment: the form may be shown; nothing has been consumed
    Valid,

    Reset,

    // keep-comment: a matching link, but past its lifetime or already used
    Expired,

    Invalid,

    // keep-comment: Keycloak's realm policy refused it; the link is NOT consumed so a stronger one can be tried
    WeakPassword,
}
