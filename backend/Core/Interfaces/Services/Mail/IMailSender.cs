// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Interfaces.Services.Mail;

// The transport, and nothing else: no queueing, no retry policy, no templating. Which
// implementation is registered depends on whether Smtp:Host is configured — see
// ServiceCollectionExtensions.
public interface IMailSender
{
    Task<MailSendResult> SendAsync(OutboxEmail email, CancellationToken ctoken);
}
