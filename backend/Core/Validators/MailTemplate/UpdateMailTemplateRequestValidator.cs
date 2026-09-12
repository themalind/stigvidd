// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Services;
using FluentValidation;
using WebDataContracts.RequestModels.MailTemplate;

namespace Core.Validators.MailTemplate;

// Only the rules that can be decided from the body alone. Whether a placeholder is legitimate
// depends on the template's Key, which is on the route and never in the request, so that
// check lives in MailTemplateAdminService instead.
public class UpdateMailTemplateRequestValidator : AbstractValidator<UpdateMailTemplateRequest>
{
    // The columns are Postgres `text` and constrain nothing, so these are a product decision
    // rather than a schema one. web/src/lib/mail-template.ts mirrors them; over these the API
    // rejects the whole request with a 400.
    public const int SubjectMaxLength = 200;
    public const int BodyMaxLength = 50_000;
    public const int DescriptionMaxLength = 500;

    public UpdateMailTemplateRequestValidator()
    {
        RuleFor(request => request.Subject)
            .NotEmpty().WithMessage("A subject is required.")
            .MaximumLength(SubjectMaxLength)
                .WithMessage($"The subject may be at most {SubjectMaxLength} characters.");

        RuleFor(request => request.BodyHtml)
            .NotEmpty().WithMessage("An HTML body is required.")
            .MaximumLength(BodyMaxLength)
                .WithMessage($"The HTML body may be at most {BodyMaxLength} characters.")
            // Custom rather than Must/WithMessage: the pair would scan the body once to
            // decide and again to build the message, and would then join every violation into
            // one blob. This reports them as separate failures, which is what the operator
            // sees listed.
            .Custom((html, context) =>
            {
                foreach (var violation in MailHtmlPolicy.Check(html))
                    context.AddFailure(violation);
            });

        // Not optional: every mail goes out as multipart/alternative, and the text part is
        // what a plain-text client shows and what keeps the mail out of a spam folder.
        RuleFor(request => request.BodyText)
            .NotEmpty().WithMessage("A plain-text body is required.")
            .MaximumLength(BodyMaxLength)
                .WithMessage($"The plain-text body may be at most {BodyMaxLength} characters.");

        RuleFor(request => request.Description)
            .MaximumLength(DescriptionMaxLength)
                .WithMessage($"The description may be at most {DescriptionMaxLength} characters.");
    }
}
