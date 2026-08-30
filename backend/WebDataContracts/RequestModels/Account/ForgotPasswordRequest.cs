// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Account;

public class ForgotPasswordRequest
{
    public required string Email { get; set; }
}
