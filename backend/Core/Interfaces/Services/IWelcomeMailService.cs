// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services;

/// <summary>
/// The greeting a new account gets.
/// </summary>
/// <remarks>
/// A service rather than an inline EnqueueAsync at the call site for two reasons: controllers
/// stay thin, and MailTemplateCatalogTests works by driving the REAL caller with a mocked
/// IMailOutboxService and capturing the model dictionary it passes — so the caller has to be
/// something a test can construct.
/// </remarks>
public interface IWelcomeMailService
{
    /// <summary>
    /// Queues the welcome mail. Never fails the caller: a greeting that could not be sent is
    /// worth a log line and nothing more.
    /// </summary>
    Task SendAsync(string email, string nickName, CancellationToken ctoken);
}
