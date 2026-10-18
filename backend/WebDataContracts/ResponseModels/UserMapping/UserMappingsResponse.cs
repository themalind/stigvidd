// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.UserMapping;

public class UserMappingsResponse
{
    public required List<MappableUserResponse> Users { get; set; }
    public required List<UserMappingResponse> Mappings { get; set; }
}
