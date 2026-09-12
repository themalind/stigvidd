// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using Infrastructure.Enums;
using WebDataContracts.RequestModels.ContentReport;

namespace Core.Validators.ContentReport;

// Form only. The daily cap lives in the service, because it needs the database and the
// signed-in identity, neither of which reaches a validator.
public class CreateContentReportRequestValidator : AbstractValidator<CreateContentReportRequest>
{
    public CreateContentReportRequestValidator()
    {
        RuleFor(request => request.ContentType)
            .NotEmpty().WithMessage("ContentType is required.")
            .Must(value => Enum.TryParse<ReportedContentType>(value, out var parsed) && parsed != ReportedContentType.Unknown)
            .WithMessage("ContentType must be Review or TrailObstacle.");

        RuleFor(request => request.ContentIdentifier)
            .NotEmpty().WithMessage("ContentIdentifier is required.")
            .Length(36).WithMessage("ContentIdentifier must be 36 characters long.");

        RuleFor(request => request.Reason)
            .NotEmpty().WithMessage("Reason is required.")
            .Must(value => Enum.TryParse<ReportReason>(value, out _))
            .WithMessage("Reason is not a known report reason.");

        RuleFor(request => request.ReporterNote)
            .MaximumLength(300).WithMessage("ReporterNote can be at most 300 characters.")
            .When(request => request.ReporterNote is not null);
    }
}
