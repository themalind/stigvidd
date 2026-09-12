// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services;

// The way application code sends mail. Renders the named template, journals the result and
// signals the dispatcher; it never touches SMTP itself, so a caller is never blocked on it.
public interface IMailOutboxService
{
    /// <summary>
    /// Queues one mail. Returns the new row's Identifier.
    /// </summary>
    /// <remarks>
    /// Fails BEFORE anything is written when the template is unknown, the model is missing a
    /// placeholder the template uses, or the address will not parse — all three are caller
    /// bugs, and reporting them here is the only point at which a caller is still listening.
    /// </remarks>
    Task<Result<string>> EnqueueAsync(
        string templateKey,
        string toAddress,
        IReadOnlyDictionary<string, string?> model,
        CancellationToken ctoken,
        string? toName = null,
        string? language = null);
}
