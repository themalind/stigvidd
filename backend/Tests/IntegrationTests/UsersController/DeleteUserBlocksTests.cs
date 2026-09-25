// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;

namespace IntegrationTests.UsersController;

public class DeleteUserBlocksTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string VandrarVennenSubject = "firebase-uid-12346";
    private const int NaturElskarenId = 1;
    private const int VandrarVennenId = 2;
    private const int SkogsGrevenId = 3;

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public DeleteUserBlocksTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();

        _factory.KeycloakAdminMock.Reset();
        _factory.KeycloakAdminMock
            .Setup(k => k.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
    }

    private StigViddDbContext Db() =>
        _factory.Services.GetRequiredService<IDbContextFactory<StigViddDbContext>>().CreateDbContext();

    private async Task SeedBlocksAroundVandrarVennenAsync()
    {
        using var db = Db();
        db.UserBlocks.Add(new UserBlock { BlockerUserId = NaturElskarenId, BlockedUserId = VandrarVennenId });
        db.UserBlocks.Add(new UserBlock { BlockerUserId = VandrarVennenId, BlockedUserId = SkogsGrevenId });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<HttpResponseMessage> DeleteVandrarVennenAsync()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", VandrarVennenSubject);
        return await client.SendAsync(
            new HttpRequestMessage(HttpMethod.Delete, "/api/v1/users/delete"),
            TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task DeleteUser_RemovesBlocksInBothDirections()
    {
        // Arrange
        await SeedBlocksAroundVandrarVennenAsync();

        // Act
        var response = await DeleteVandrarVennenAsync();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        using var db = Db();
        var remaining = await db.UserBlocks
            .Where(ub => ub.BlockerUserId == VandrarVennenId || ub.BlockedUserId == VandrarVennenId)
            .CountAsync(TestContext.Current.CancellationToken);
        remaining.Should().Be(0);
    }

    [Fact]
    public async Task DeleteUser_WhenKeycloakDeleteFails_KeepsTheUserAndTheirBlocks()
    {
        // Arrange
        await SeedBlocksAroundVandrarVennenAsync();
        _factory.KeycloakAdminMock
            .Setup(k => k.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("Keycloak unavailable"));

        // Act
        var response = await DeleteVandrarVennenAsync();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.InternalServerError);
        using var db = Db();
        (await db.Users.AnyAsync(u => u.Id == VandrarVennenId, TestContext.Current.CancellationToken)).Should().BeTrue();
        var remaining = await db.UserBlocks
            .Where(ub => ub.BlockerUserId == VandrarVennenId || ub.BlockedUserId == VandrarVennenId)
            .CountAsync(TestContext.Current.CancellationToken);
        remaining.Should().Be(2);
    }
}
