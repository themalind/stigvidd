// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.UserMapping;

public class MappableUserResponse
{
    public int Id { get; set; }
    public required string NickName { get; set; }
    public required string Email { get; set; }
    public int HikeCount { get; set; }
    public bool IsMapped { get; set; }
}
