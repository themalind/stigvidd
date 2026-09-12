// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging;

namespace Core.Services;

// Registered instead of SmtpMailSender when Smtp:Host is not configured — local development,
// the test suite, a partial stack that runs no mail server.
//
// It reports success, so the outbox drains rather than accumulating rows that would retry
// forever on a machine that was never going to send them. The warning is the point: "mail
// went missing in production" then reads as a log line naming the missing setting.
public class LoggingMailSender : IMailSender
{
    private readonly ILogger<LoggingMailSender> _logger;

    public LoggingMailSender(ILogger<LoggingMailSender> logger)
    {
        _logger = logger;
    }

    public Task<MailSendResult> SendAsync(OutboxEmail email, CancellationToken ctoken)
    {
        _logger.LogWarning(
            "LoggingMailSender: Smtp:Host is not configured, so nothing was sent. Mail {identifier} to {to}, subject {subject}.",
            email.Identifier, email.ToAddress, email.Subject);

        return Task.FromResult(MailSendResult.Ok());
    }
}
