// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Services.DataTransfer;

public static class DataTransferPreflight
{
    // Decides everything before the first destructive step, so a refusal leaves the host untouched. keep-comment: why this runs before any restore
    public static ImportPlan Plan(
        DataTransferManifest manifest,
        bool archiveHasKeycloakDump,
        IReadOnlyCollection<string> knownMigrations,
        bool sharedServices,
        bool keycloakDatabaseExists)
    {
        if (manifest.FormatVersion != DataTransferManifest.CurrentFormatVersion)
            throw new InvalidOperationException(
                $"Unsupported export format version {manifest.FormatVersion}; this server expects {DataTransferManifest.CurrentFormatVersion}. "
                + "Export again from a host running the same version.");

        if (manifest.LatestMigration is null)
            throw new InvalidOperationException("The archive does not say which database migration it was exported at.");

        if (!knownMigrations.Contains(manifest.LatestMigration))
            throw new InvalidOperationException(
                $"The archive was exported at migration '{manifest.LatestMigration}', which this server does not know. "
                + "Deploy the same or a newer version here before importing.");

        var notes = new List<string>();
        var restoreKeycloak = false;

        if (archiveHasKeycloakDump && sharedServices)
        {
            notes.Add("The archive contains Keycloak users. They were not restored: this host uses another host's Keycloak.");
        }
        else if (archiveHasKeycloakDump)
        {
            if (!keycloakDatabaseExists)
                throw new InvalidOperationException(
                    "The archive contains Keycloak users, but this host has no Keycloak database to restore them into. "
                    + "Create it (see db/init/02-keycloak-db.sql) and import again.");

            restoreKeycloak = true;
        }

        if (sharedServices)
            notes.Add("Queued mail, push tokens and verification/reset codes were cleared: this host sends through production's mail server.");

        if (manifest.Anonymized)
            notes.Add("The archive is anonymized: users have placeholder names and addresses and cannot sign in, except those mapped to a Keycloak user.");

        return new ImportPlan(restoreKeycloak, sharedServices, notes);
    }
}
