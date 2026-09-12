// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Interfaces.Services;

// The transport, and nothing else: no queueing, no retry policy, no templating. Which
// implementation is registered depends on whether Smtp:Host is configured — see
// ServiceCollectionExtensions.
public interface IMailSender
{
    Task<MailSendResult> SendAsync(OutboxEmail email, CancellationToken ctoken);
}

/// <param name="Permanent">
/// True when retrying cannot help — the server rejected the message itself (a 5xx reply: no
/// such mailbox, sender refused). The dispatcher parks those immediately instead of spending
/// five attempts to be told the same thing five times.
/// </param>
public record MailSendResult(bool Success, bool Permanent, string? Error)
{
    public static MailSendResult Ok() => new(true, false, null);
    public static MailSendResult Transient(string error) => new(false, false, error);
    public static MailSendResult PermanentFailure(string error) => new(false, true, error);
}
