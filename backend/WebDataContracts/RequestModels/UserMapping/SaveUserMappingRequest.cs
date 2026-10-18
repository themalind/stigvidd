// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.UserMapping;

public class SaveUserMappingRequest
{
    public required string KeycloakSubjectId { get; set; }
    public required string NickName { get; set; }
    public required string Email { get; set; }
}
