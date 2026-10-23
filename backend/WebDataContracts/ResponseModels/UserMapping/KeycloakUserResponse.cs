// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.UserMapping;

public class KeycloakUserResponse
{
    public required string Id { get; set; }
    public required string Username { get; set; }
    public string? Email { get; set; }
    public bool Enabled { get; set; }
}
