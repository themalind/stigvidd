// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Mail.Models;

// keep-comment: Permanent means the server rejected the message itself (5xx), so the dispatcher parks it instead of retrying
public record MailSendResult(bool Success, bool Permanent, string? Error)
{
    public static MailSendResult Ok()
    {
        return new(true, false, null);
    }

    public static MailSendResult Transient(string error)
    {
        return new(false, false, error);
    }

    public static MailSendResult PermanentFailure(string error)
    {
        return new(false, true, error);
    }
}
