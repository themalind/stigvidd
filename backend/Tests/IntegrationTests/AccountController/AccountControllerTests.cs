using Core.Interfaces.Repositories;
using FluentAssertions;
using Moq;
using StigviddAPI;
using System.Net;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.Account;

namespace IntegrationTests.AccountController;

public class AccountControllerTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string RegisterUrl = "/api/v1/account/register";
    private const string ForgotPasswordUrl = "/api/v1/account/forgot-password";
    private const string KeycloakSubjectId = "kc-subject-id";

    // A nickname seeded by Utilities.GetSeedingUsers (User 1) — taken, so the DB insert is rejected.
    private const string TakenNickName = "NaturElskaren";

    public AccountControllerTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();

        // Reset the shared Keycloak mock to a clean, succeeding baseline before each test.
        // Building the host (via SeedDatabase) has already registered KeycloakAdminMock.Object,
        // so reconfiguring it here changes the behaviour the running controller sees.
        _factory.KeycloakAdminMock.Reset();
        _factory.KeycloakAdminMock
            .Setup(k => k.CreateUserAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(KeycloakSubjectId);
        _factory.KeycloakAdminMock
            .Setup(k => k.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _factory.KeycloakAdminMock
            .Setup(k => k.SendPasswordResetEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
    }

    [Fact]
    public async Task Register_WhenValid_ProvisionsUserAndReturnsCreated()
    {
        // Arrange
        var client = _factory.CreateClient();
        var request = new RegisterRequest
        {
            Email = "newbie@test.local",
            NickName = "FreshNick",
            Password = "Password123!",
        };

        // Act
        var response = await client.PostAsJsonAsync(RegisterUrl, request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        _factory.KeycloakAdminMock.Verify(
            k => k.CreateUserAsync(request.Email, request.NickName, request.Password, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Register_WhenKeycloakReportsConflict_ReturnsConflict()
    {
        // Arrange
        _factory.KeycloakAdminMock
            .Setup(k => k.CreateUserAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeycloakUserConflictException("A user with that email already exists."));
        var client = _factory.CreateClient();
        var request = new RegisterRequest
        {
            Email = "existing@test.local",
            NickName = "FreshNick",
            Password = "Password123!",
        };

        // Act
        var response = await client.PostAsJsonAsync(RegisterUrl, request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Register_WhenDbCreateFails_RollsBackTheKeycloakUser()
    {
        // Arrange: Keycloak provisioning succeeds, but the nickname is already taken in the DB,
        // so the StigVidd record cannot be created and the Keycloak user must be rolled back.
        var client = _factory.CreateClient();
        var request = new RegisterRequest
        {
            Email = "rollback@test.local",
            NickName = TakenNickName,
            Password = "Password123!",
        };

        // Act
        var response = await client.PostAsJsonAsync(RegisterUrl, request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        _factory.KeycloakAdminMock.Verify(
            k => k.DeleteUserAsync(KeycloakSubjectId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ForgotPassword_WhenEmailExists_ReturnsNoContent()
    {
        // Arrange
        var client = _factory.CreateClient();
        var request = new ForgotPasswordRequest { Email = "natur@example.local" };

        // Act
        var response = await client.PostAsJsonAsync(ForgotPasswordUrl, request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task ForgotPassword_WhenKeycloakThrows_StillReturnsNoContent()
    {
        // Arrange: the endpoint must never leak whether the email is registered, so it swallows
        // Keycloak failures and always responds 204.
        _factory.KeycloakAdminMock
            .Setup(k => k.SendPasswordResetEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Keycloak unavailable"));
        var client = _factory.CreateClient();
        var request = new ForgotPasswordRequest { Email = "unknown@test.local" };

        // Act
        var response = await client.PostAsJsonAsync(ForgotPasswordUrl, request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }
}
