// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.User;

public class CreateUserRequest
{
    public required string Email { get; set; }
    public required string NickName { get; set; }
}
