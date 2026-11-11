// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Mail.Models;

public record RenderedMail(string Subject, string BodyHtml, string BodyText);
