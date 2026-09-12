// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.RequestModels.MailTemplate;
using WebDataContracts.ResponseModels.MailTemplate;

namespace Core.Interfaces.Services;

// Reading and editing mail copy. Nothing here sends anything; MailOutboxService does that,
// and reads the same rows through IMailTemplateRepository.GetByKeyAsync.
public interface IMailTemplateAdminService
{
    Task<Result<List<MailTemplateListItemResponse>>> ListAsync(CancellationToken ctoken);

    Task<Result<MailTemplateResponse>> GetAsync(string identifier, CancellationToken ctoken);

    Task<Result<MailTemplateResponse>> UpdateAsync(
        string identifier, UpdateMailTemplateRequest request, CancellationToken ctoken);

    // Renders an UNSAVED draft with the catalogue's sample values, through the same renderer
    // a real send uses -- so a draft that previews is a draft that will render.
    Task<Result<MailTemplatePreviewResponse>> PreviewAsync(
        string identifier, PreviewMailTemplateRequest request, CancellationToken ctoken);
}
