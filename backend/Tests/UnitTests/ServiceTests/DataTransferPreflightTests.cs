// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services;

namespace UnitTests.ServiceTests;

public class DataTransferPreflightTests
{
    private const string Known = "20261003135859_WelcomeMailSentAfterVerification";
    private static readonly string[] KnownMigrations = ["20260101000000_Initial", Known];

    private static DataTransferManifest Manifest(int? version = null, string? migration = Known, bool anonymized = false) => new()
    {
        FormatVersion = version ?? DataTransferManifest.CurrentFormatVersion,
        LatestMigration = migration,
        Anonymized = anonymized,
    };

    [Fact]
    public void Plan_RefusesAnOtherFormatVersion()
    {
        var act = () => DataTransferPreflight.Plan(Manifest(version: 1), false, KnownMigrations, false, false);

        act.Should().Throw<InvalidOperationException>().WithMessage("*format version 1*");
    }

    [Fact]
    public void Plan_RefusesAnArchiveFromNewerCode()
    {
        var act = () => DataTransferPreflight.Plan(Manifest(migration: "20991231000000_FromTheFuture"), false, KnownMigrations, false, false);

        act.Should().Throw<InvalidOperationException>().WithMessage("*20991231000000_FromTheFuture*");
    }

    [Fact]
    public void Plan_RefusesAnArchiveThatNamesNoMigration()
    {
        var act = () => DataTransferPreflight.Plan(Manifest(migration: null), false, KnownMigrations, false, false);

        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Plan_OnAPrimaryHost_RestoresKeycloakAndLeavesOutboundAlone()
    {
        var plan = DataTransferPreflight.Plan(Manifest(), archiveHasKeycloakDump: true, KnownMigrations, sharedServices: false, keycloakDatabaseExists: true);

        plan.RestoreKeycloak.Should().BeTrue();
        plan.NeutralizeOutbound.Should().BeFalse();
    }

    [Fact]
    public void Plan_OnAPrimaryHostWithoutAKeycloakDatabase_RefusesBeforeAnythingIsReplaced()
    {
        var act = () => DataTransferPreflight.Plan(Manifest(), archiveHasKeycloakDump: true, KnownMigrations, sharedServices: false, keycloakDatabaseExists: false);

        act.Should().Throw<InvalidOperationException>().WithMessage("*Keycloak database*");
    }

    [Fact]
    public void Plan_OnASharedServicesHost_SkipsKeycloakAndClearsOutbound()
    {
        var plan = DataTransferPreflight.Plan(Manifest(), archiveHasKeycloakDump: true, KnownMigrations, sharedServices: true, keycloakDatabaseExists: true);

        plan.RestoreKeycloak.Should().BeFalse();
        plan.NeutralizeOutbound.Should().BeTrue();
        plan.Notes.Should().Contain(n => n.Contains("Keycloak users") && n.Contains("not restored"));
    }

    [Fact]
    public void Plan_OnASharedServicesHost_ClearsOutboundEvenForAnArchiveWithoutKeycloak()
    {
        var plan = DataTransferPreflight.Plan(Manifest(anonymized: true), archiveHasKeycloakDump: false, KnownMigrations, sharedServices: true, keycloakDatabaseExists: false);

        plan.RestoreKeycloak.Should().BeFalse();
        plan.NeutralizeOutbound.Should().BeTrue();
    }

    [Fact]
    public void Manifest_RoundTripsThroughJson()
    {
        var manifest = Manifest(anonymized: true) with { MediaExported = 3, TrailImportFiles = 2, IncludesKeycloak = false };

        using var stream = new MemoryStream(manifest.ToJson());
        var parsed = DataTransferManifest.Parse(stream);

        parsed.Should().Be(manifest);
    }

    [Fact]
    public void Manifest_UnreadableJson_IsRefusedAsAnInvalidArchive()
    {
        using var stream = new MemoryStream("not json"u8.ToArray());

        var act = () => DataTransferManifest.Parse(stream);

        act.Should().Throw<InvalidOperationException>().WithMessage("*manifest.json*");
    }
}
