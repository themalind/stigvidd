// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using System.Net;

namespace Core.Services;

public class MailOutboxService : IMailOutboxService
{
    private const string FallbackLanguage = "sv";

    private readonly IMailTemplateRepository _templateRepository;
    private readonly IMailOutboxRepository _outboxRepository;
    private readonly IMailTemplateRenderer _renderer;
    private readonly IMailOutboxQueue _queue;
    private readonly ILogger<MailOutboxService> _logger;
    private readonly string _defaultLanguage;

    public MailOutboxService(
        IMailTemplateRepository templateRepository,
        IMailOutboxRepository outboxRepository,
        IMailTemplateRenderer renderer,
        IMailOutboxQueue queue,
        IConfiguration configuration,
        ILogger<MailOutboxService> logger)
    {
        _templateRepository = templateRepository;
        _outboxRepository = outboxRepository;
        _renderer = renderer;
        _queue = queue;
        _logger = logger;

        var configured = configuration["MailOutbox:DefaultLanguage"];
        _defaultLanguage = string.IsNullOrWhiteSpace(configured) ? FallbackLanguage : configured;
    }

    public async Task<Result<string>> EnqueueAsync(
        string templateKey,
        string toAddress,
        IReadOnlyDictionary<string, string?> model,
        CancellationToken ctoken,
        string? toName = null,
        string? language = null)
    {
        // Step 1: refuse an address that will not parse. Letting it through would mean a row
        // that can only ever fail, discovered five attempts later with nobody to tell.
        if (!IsSendableAddress(toAddress))
        {
            _logger.LogWarning("MailOutboxService: EnqueueAsync -> Refused an unparseable recipient address for template {key}.", templateKey);
            return Result.Fail<string>(new Message((int)HttpStatusCode.BadRequest, "The recipient address is not a valid email address."));
        }

        var wanted = string.IsNullOrWhiteSpace(language) ? _defaultLanguage : language;

        // Step 2: find the template, falling back to the default language.
        var templateResult = await _templateRepository.GetByKeyAsync(templateKey, wanted, ctoken);

        if (templateResult.Status == RepositoryResultStatus.NotFound && wanted != _defaultLanguage)
            templateResult = await _templateRepository.GetByKeyAsync(templateKey, _defaultLanguage, ctoken);

        if (templateResult.Status == RepositoryResultStatus.Error)
        {
            _logger.LogError("MailOutboxService: EnqueueAsync -> Failed to load mail template {key}/{language}.", templateKey, wanted);
            return Result.Fail<string>(new Message((int)HttpStatusCode.InternalServerError, "An error occurred while loading the mail template."));
        }

        if (!templateResult.IsSuccess)
        {
            _logger.LogError("MailOutboxService: EnqueueAsync -> No mail template {key} in {language} or {fallback}.", templateKey, wanted, _defaultLanguage);
            return Result.Fail<string>(new Message((int)HttpStatusCode.NotFound, $"No mail template found for key '{templateKey}'."));
        }

        // Step 3: render now, not at send time. A missing placeholder is a caller bug and
        // this is the last moment a caller is listening.
        var rendered = _renderer.Render(templateResult.Value, model);
        if (rendered.IsFailure)
        {
            _logger.LogError("MailOutboxService: EnqueueAsync -> Template {key} could not be rendered: {reason}", templateKey, rendered.Message?.ResultMessage);
            return Result.Fail<string>(rendered.Message!);
        }

        // Step 4: journal it. Until this succeeds there is nothing to signal.
        var email = new OutboxEmail
        {
            ToAddress = toAddress,
            ToName = toName,
            Subject = rendered.Value!.Subject,
            BodyHtml = rendered.Value.BodyHtml,
            BodyText = rendered.Value.BodyText,
            TemplateKey = templateKey,
            Status = OutboxEmailStatus.Pending,
            NextAttemptAt = DateTime.UtcNow,
        };

        var added = await _outboxRepository.AddAsync(email, ctoken);
        if (!added.IsSuccess)
        {
            _logger.LogError("MailOutboxService: EnqueueAsync -> Failed to queue mail for template {key}.", templateKey);
            return Result.Fail<string>(new Message((int)HttpStatusCode.InternalServerError, "An error occurred while queueing the mail."));
        }

        // Step 5: only now signal the dispatcher. Signalling first would hand it an id it
        // cannot read yet. If this process dies before the signal is picked up, the row is
        // still Pending and the next start re-queues it.
        _queue.Enqueue(added.Value.Id);

        return Result.Ok(added.Value.Identifier);
    }

    // MimeKit's parser is deliberately lenient: it accepts a bare local part ("vandrare") as a
    // mailbox with an empty domain, which submission then refuses. Requiring a domain here is
    // what keeps that refusal at the call site instead of five attempts into the outbox.
    private static bool IsSendableAddress(string address)
    {
        if (!MailboxAddress.TryParse(address, out var parsed) || parsed.Address is null)
            return false;

        var at = parsed.Address.LastIndexOf('@');

        // Something before the @, something after it.
        return at > 0 && at < parsed.Address.Length - 1;
    }
}
