// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Repositories;
using Keycloak.AuthServices.Sdk.Admin;
using Keycloak.AuthServices.Sdk.Admin.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using System.Net;

namespace UnitTests.RepositoryTests;

/// <summary>
/// The provisioning half of the email-verification gate. The app logs in straight against
/// Keycloak, so this API is never in the login path — a new user being DISABLED here is the
/// only thing that stops an unverified address signing in, and these pin it.
/// </summary>
public class KeycloakAdminRepositoryTests
{
    private const string Realm = "stigvidd";
    private const string SubjectId = "kc-subject-id";

    private static KeycloakAdminRepository Build(Mock<IKeycloakUserClient> client)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Keycloak:realm"] = Realm })
            .Build();

        return new KeycloakAdminRepository(
            client.Object,
            configuration,
            NullLogger<KeycloakAdminRepository>.Instance);
    }

    private static Mock<IKeycloakUserClient> ClientCreating(UserRepresentation captured)
    {
        var client = new Mock<IKeycloakUserClient>();

        var response = new HttpResponseMessage(HttpStatusCode.Created);
        response.Headers.Location = new Uri($"http://keycloak/admin/realms/{Realm}/users/{SubjectId}");

        client
            .Setup(c => c.CreateUserWithResponseAsync(Realm, It.IsAny<UserRepresentation>(), It.IsAny<CancellationToken>()))
            .Callback<string, UserRepresentation, CancellationToken>((_, representation, _) =>
            {
                captured.Enabled = representation.Enabled;
                captured.EmailVerified = representation.EmailVerified;
            })
            .ReturnsAsync(response);

        return client;
    }

    [Fact]
    public async Task CreateUserAsync_CreatesTheUserDisabledAndUnverified()
    {
        // Arrange
        var captured = new UserRepresentation();
        var client = ClientCreating(captured);

        // Act
        var subjectId = await Build(client).CreateUserAsync(
            "newbie@test.local", "FreshNick", "Password123!", CancellationToken.None);

        // Assert
        subjectId.Should().Be(SubjectId);
        captured.Enabled.Should().BeFalse("an unverified account must not be able to log in");
        captured.EmailVerified.Should().BeFalse();
    }

    [Fact]
    public async Task ActivateVerifiedUserAsync_EnablesTheUserAndMarksTheEmailVerified()
    {
        // Arrange
        var client = new Mock<IKeycloakUserClient>();
        UserRepresentation? sent = null;

        client
            .Setup(c => c.UpdateUserAsync(Realm, SubjectId, It.IsAny<UserRepresentation>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, UserRepresentation, CancellationToken>((_, _, representation, _) => sent = representation)
            .Returns(Task.CompletedTask);

        // Act
        await Build(client).ActivateVerifiedUserAsync(SubjectId, CancellationToken.None);

        // Assert
        sent.Should().NotBeNull();
        sent!.Enabled.Should().BeTrue();
        sent.EmailVerified.Should().BeTrue();
    }
}
