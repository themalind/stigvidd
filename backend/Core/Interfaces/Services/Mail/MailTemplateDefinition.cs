// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Mail;

public sealed record MailTemplateDefinition(
    string Key,
    string Purpose,
    IReadOnlyList<MailTemplateToken> Tokens);
