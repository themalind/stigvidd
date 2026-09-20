// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.Extensions.Logging;

namespace Core.Services;

public class WelcomeMailService : IWelcomeMailService
{
    // The template seeded by the AddMailOutbox migration.
    public const string TemplateKey = "welcome";

    private readonly IMailOutboxService _mailOutboxService;
    private readonly ILogger<WelcomeMailService> _logger;

    public WelcomeMailService(
        IMailOutboxService mailOutboxService, ILogger<WelcomeMailService> logger)
    {
        _mailOutboxService = mailOutboxService;
        _logger = logger;
    }

    public async Task SendAsync(string email, string nickName, CancellationToken ctoken)
    {
        // Deliberately the opposite of the verification mail, which rolls a whole registration
        // back when it cannot be queued. That one is the only thing standing between the user
        // and an account they can log in to; this one is a courtesy, and deleting somebody's
        // new account because a greeting did not render would be absurd.
        try
        {
            var enqueued = await _mailOutboxService.EnqueueAsync(
                TemplateKey,
                email,
                new Dictionary<string, string?>
                {
                    ["NickName"] = nickName,
                },
                ctoken,
                toName: nickName);

            if (!enqueued.Success)
                _logger.LogError(
                    "WelcomeMailService: SendAsync -> Could not queue the welcome mail: {status} {message}",
                    enqueued.Message?.StatusCode,
                    enqueued.Message?.ResultMessage);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WelcomeMailService: SendAsync -> Could not queue the welcome mail.");
        }
    }
}
