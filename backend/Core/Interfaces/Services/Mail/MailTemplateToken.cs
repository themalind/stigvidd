// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Mail;

// keep-comment: one {{Placeholder}} a template may use; Name is exactly as written between the braces, SampleValue feeds the preview
public sealed record MailTemplateToken(
    string Name,
    string Label,
    string Description,
    string SampleValue);
