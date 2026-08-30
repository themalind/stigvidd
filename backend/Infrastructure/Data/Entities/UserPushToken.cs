// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

public class UserPushToken : BaseEntity
{
    public int UserId { get; set; }
    public required string ExpoToken { get; set; }
    public required string Platform { get; set; }

    public User? User { get; set; }
}
