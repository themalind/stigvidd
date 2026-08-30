// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later


namespace WebDataContracts.RequestModels.PushToken;

public class RegisterPushTokenRequest
{
    public required string ExpoToken { get; set; }
    public required string Platform { get; set; }
}
