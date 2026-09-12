// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.MailTemplate;

namespace Core.Validators.MailTemplate;

// Looser than the update validator on purpose. A preview writes nothing and sends nothing, so
// the operator should be able to look at a draft that is not yet saveable -- including one
// whose markup the policy will refuse -- and see why.
public class PreviewMailTemplateRequestValidator : AbstractValidator<PreviewMailTemplateRequest>
{
    public PreviewMailTemplateRequestValidator()
    {
        RuleFor(request => request.Subject)
            .MaximumLength(UpdateMailTemplateRequestValidator.SubjectMaxLength);

        RuleFor(request => request.BodyHtml)
            .MaximumLength(UpdateMailTemplateRequestValidator.BodyMaxLength);

        RuleFor(request => request.BodyText)
            .MaximumLength(UpdateMailTemplateRequestValidator.BodyMaxLength);
    }
}
