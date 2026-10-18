// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.UserMapping;

public class UserMappingResponse
{
    public int PackageUserId { get; set; }
    public required string KeycloakSubjectId { get; set; }
    public required string KeycloakUsername { get; set; }
    public required string NickName { get; set; }
    public required string Email { get; set; }
    public DateTime CreatedAt { get; set; }
}
