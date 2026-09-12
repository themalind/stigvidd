// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging;
using System.Net;
using WebDataContracts.RequestModels.MailTemplate;
using WebDataContracts.ResponseModels.MailTemplate;

namespace Core.Services;

public class MailTemplateAdminService : IMailTemplateAdminService
{
    private readonly IMailTemplateRepository _repository;
    private readonly IMailTemplateCatalog _catalog;
    private readonly IMailTemplateRenderer _renderer;
    private readonly MailTemplateResponseFactory _factory;
    private readonly ILogger<MailTemplateAdminService> _logger;

    public MailTemplateAdminService(
        IMailTemplateRepository repository,
        IMailTemplateCatalog catalog,
        IMailTemplateRenderer renderer,
        MailTemplateResponseFactory factory,
        ILogger<MailTemplateAdminService> logger)
    {
        _repository = repository;
        _catalog = catalog;
        _renderer = renderer;
        _factory = factory;
        _logger = logger;
    }

    public async Task<Result<List<MailTemplateListItemResponse>>> ListAsync(CancellationToken ctoken)
    {
        var result = await _repository.GetAllAsync(ctoken);

        if (!result.IsSuccess)
        {
            _logger.LogError("MailTemplateAdminService: ListAsync -> Failed to list mail templates.");
            return Result.Fail<List<MailTemplateListItemResponse>>(
                new Message((int)HttpStatusCode.InternalServerError, "An error occurred while loading the mail templates."));
        }

        return Result.Ok(result.Value
            .Select(template => _factory.CreateListItem(template, _catalog.Find(template.Key)))
            .ToList());
    }

    public async Task<Result<MailTemplateResponse>> GetAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _repository.GetByIdentifierAsync(identifier, ctoken);

        if (result.Status == RepositoryResultStatus.NotFound)
            return NotFound<MailTemplateResponse>(identifier);

        if (!result.IsSuccess)
        {
            _logger.LogError("MailTemplateAdminService: GetAsync -> Failed to load mail template {identifier}.", identifier);
            return Result.Fail<MailTemplateResponse>(
                new Message((int)HttpStatusCode.InternalServerError, "An error occurred while loading the mail template."));
        }

        return Result.Ok(_factory.Create(result.Value, _catalog.Find(result.Value.Key)));
    }

    public async Task<Result<MailTemplateResponse>> UpdateAsync(
        string identifier, UpdateMailTemplateRequest request, CancellationToken ctoken)
    {
        // The key decides which placeholders are legitimate, and the key is on the route
        // rather than in the body -- which is why this check lives here and not in
        // UpdateMailTemplateRequestValidator, which only ever sees the body.
        var existing = await _repository.GetByIdentifierAsync(identifier, ctoken);

        if (existing.Status == RepositoryResultStatus.NotFound)
            return NotFound<MailTemplateResponse>(identifier);

        if (!existing.IsSuccess)
        {
            _logger.LogError("MailTemplateAdminService: UpdateAsync -> Failed to load mail template {identifier}.", identifier);
            return Result.Fail<MailTemplateResponse>(
                new Message((int)HttpStatusCode.InternalServerError, "An error occurred while loading the mail template."));
        }

        // The draft as it would be stored, so the same code that reports unknown placeholders
        // in the response is the code that decides whether to refuse the save.
        var draft = new MailTemplate
        {
            Key = existing.Value.Key,
            Language = existing.Value.Language,
            Subject = request.Subject,
            BodyHtml = request.BodyHtml,
            BodyText = request.BodyText,
        };

        var unknown = _factory.UnknownTokens(draft, _catalog.Find(existing.Value.Key));

        if (unknown.Count > 0)
        {
            // Refusing rather than warning, because this edit would stop the mail entirely:
            // MailTemplateRenderer fails the whole render on a placeholder with no model
            // value, and MailOutboxService.EnqueueAsync fails with it. For verify-email that
            // is registration, and nothing would report it until somebody could not sign up.
            var names = string.Join(", ", unknown.Select(name => $"{{{{{name}}}}}"));

            return Result.Fail<MailTemplateResponse>(new Message(
                (int)HttpStatusCode.BadRequest,
                $"The template uses {names}, which '{existing.Value.Key}' does not supply. "
                    + "Mail using an unknown placeholder fails to send, so this cannot be saved."));
        }

        var updated = await _repository.UpdateAsync(
            identifier, request.Subject, request.BodyHtml, request.BodyText, request.Description, ctoken);

        if (updated.Status == RepositoryResultStatus.NotFound)
            return NotFound<MailTemplateResponse>(identifier);

        if (!updated.IsSuccess)
        {
            _logger.LogError("MailTemplateAdminService: UpdateAsync -> Failed to update mail template {identifier}.", identifier);
            return Result.Fail<MailTemplateResponse>(
                new Message((int)HttpStatusCode.InternalServerError, "An error occurred while saving the mail template."));
        }

        _logger.LogInformation(
            "MailTemplateAdminService: UpdateAsync -> Mail template {key}/{language} was edited.",
            updated.Value.Key, updated.Value.Language);

        return Result.Ok(_factory.Create(updated.Value, _catalog.Find(updated.Value.Key)));
    }

    public async Task<Result<MailTemplatePreviewResponse>> PreviewAsync(
        string identifier, PreviewMailTemplateRequest request, CancellationToken ctoken)
    {
        var existing = await _repository.GetByIdentifierAsync(identifier, ctoken);

        if (existing.Status == RepositoryResultStatus.NotFound)
            return NotFound<MailTemplatePreviewResponse>(identifier);

        if (!existing.IsSuccess)
        {
            _logger.LogError("MailTemplateAdminService: PreviewAsync -> Failed to load mail template {identifier}.", identifier);
            return Result.Fail<MailTemplatePreviewResponse>(
                new Message((int)HttpStatusCode.InternalServerError, "An error occurred while loading the mail template."));
        }

        var definition = _catalog.Find(existing.Value.Key);

        var model = (definition?.Tokens ?? [])
            .ToDictionary(token => token.Name, token => (string?)token.SampleValue, StringComparer.OrdinalIgnoreCase);

        // Deliberately the real renderer over a throwaway entity rather than a preview-only
        // code path: this is the whole value of the preview. If the draft would fail at
        // enqueue, it fails here instead, with the identical message, before it is saved.
        var draft = new MailTemplate
        {
            Key = existing.Value.Key,
            Language = existing.Value.Language,
            Subject = request.Subject,
            BodyHtml = request.BodyHtml,
            BodyText = request.BodyText,
        };

        var rendered = _renderer.Render(draft, model);

        if (rendered.IsFailure)
            return Result.Fail<MailTemplatePreviewResponse>(rendered.Message!);

        return Result.Ok(MailTemplatePreviewResponse.Create(
            rendered.Value!.Subject, rendered.Value.BodyHtml, rendered.Value.BodyText));
    }

    private static Result<T> NotFound<T>(string identifier) =>
        Result.Fail<T>(new Message(
            (int)HttpStatusCode.NotFound, $"No mail template found with identifier '{identifier}'."));
}
