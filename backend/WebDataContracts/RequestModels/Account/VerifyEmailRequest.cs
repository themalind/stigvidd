// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Account;

public class VerifyEmailRequest
{
    public required string Email { get; set; }

    /// <summary>The six-digit code from the verification mail.</summary>
    public required string Code { get; set; }
}
