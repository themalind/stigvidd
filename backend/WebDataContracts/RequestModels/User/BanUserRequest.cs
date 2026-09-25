// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.User;

public class BanUserRequest
{
    // Shown to nobody but the next moderator; the banned account is told nothing.
    public string? Reason { get; set; }
}
