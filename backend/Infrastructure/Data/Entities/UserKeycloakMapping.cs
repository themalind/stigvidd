// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

// Says which existing Keycloak user an imported (usually anonymized) user row stands for, so the
// person keeps their sign-in, nickname and email across data imports. Keyed by the user's Id
// because that is the one value anonymization leaves alone. No foreign key: the row has to
// outlive the import that replaces Users.
public class UserKeycloakMapping
{
    public int PackageUserId { get; set; }

    public required string KeycloakSubjectId { get; set; }
    public required string KeycloakUsername { get; set; }
    public required string NickName { get; set; }
    public required string Email { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
