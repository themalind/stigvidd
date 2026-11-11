// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Account.Models;

public record KeycloakUserSummary(string Id, string Username, string? Email, bool Enabled);
