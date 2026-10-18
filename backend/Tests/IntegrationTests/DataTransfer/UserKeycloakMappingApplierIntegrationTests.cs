// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StigviddAPI;

namespace IntegrationTests.DataTransfer;

public class UserKeycloakMappingApplierIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string NaturElskarenIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public UserKeycloakMappingApplierIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private StigViddDbContext NewContext() =>
        _factory.Services.GetRequiredService<IDbContextFactory<StigViddDbContext>>().CreateDbContext();

    private static UserKeycloakMapping MappingFor(int userId, string nickName = "StagingPerson", string subjectId = "staging-sub") => new()
    {
        PackageUserId = userId,
        KeycloakSubjectId = subjectId,
        KeycloakUsername = "staging.person@example.local",
        NickName = nickName,
        Email = "staging.person@example.local",
    };

    private async Task<int> AnonymizedUserIdAsync()
    {
        await using var db = NewContext();
        var userId = (await db.Users.SingleAsync(u => u.Identifier == NaturElskarenIdentifier, TestContext.Current.CancellationToken)).Id;
        await DataAnonymizer.AnonymizeAsync(db, TestContext.Current.CancellationToken);

        return userId;
    }

    [Fact]
    public async Task Apply_GivesTheAnonymizedUserTheMappedIdentity()
    {
        // Arrange
        var userId = await AnonymizedUserIdAsync();
        await using var db = NewContext();
        db.UserKeycloakMappings.Add(MappingFor(userId));
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var applied = await UserKeycloakMappingApplier.ApplyAsync(db, TestContext.Current.CancellationToken);

        // Assert
        applied.Should().Be(1);
        await using var check = NewContext();
        var user = await check.Users.SingleAsync(u => u.Id == userId, TestContext.Current.CancellationToken);
        user.SubjectId.Should().Be("staging-sub");
        user.NickName.Should().Be("StagingPerson");
        user.Email.Should().Be("staging.person@example.local");
        user.EmailVerifiedAt.Should().NotBeNull();

        var hikes = await check.Hikes.Where(h => h.UserId == userId).ToListAsync(TestContext.Current.CancellationToken);
        hikes.Should().NotBeEmpty();
        hikes.Should().AllSatisfy(h => h.CreatedByNickName.Should().Be("StagingPerson"));
    }

    [Fact]
    public async Task Apply_MovesAnotherUserOffTheNicknameAndSubjectItTakes()
    {
        // Arrange
        var userId = await AnonymizedUserIdAsync();
        await using var db = NewContext();
        var other = await db.Users.FirstAsync(u => u.Id != userId, TestContext.Current.CancellationToken);
        other.NickName = "StagingPerson";
        other.SubjectId = "staging-sub";
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        db.UserKeycloakMappings.Add(MappingFor(userId));
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        await UserKeycloakMappingApplier.ApplyAsync(db, TestContext.Current.CancellationToken);

        // Assert
        await using var check = NewContext();
        var moved = await check.Users.SingleAsync(u => u.Id == other.Id, TestContext.Current.CancellationToken);
        moved.NickName.Should().Be($"user-{other.Id}");
        moved.SubjectId.Should().NotBe("staging-sub");
        (await check.Users.CountAsync(u => u.SubjectId == "staging-sub", TestContext.Current.CancellationToken)).Should().Be(1);
    }

    [Fact]
    public async Task Apply_KeepsAMappingWhoseUserIsNotInTheArchive()
    {
        // Arrange
        await using var db = NewContext();
        db.UserKeycloakMappings.Add(MappingFor(9999));
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var applied = await UserKeycloakMappingApplier.ApplyAsync(db, TestContext.Current.CancellationToken);

        // Assert
        applied.Should().Be(0);
        (await db.UserKeycloakMappings.CountAsync(TestContext.Current.CancellationToken)).Should().Be(1);
    }
}
