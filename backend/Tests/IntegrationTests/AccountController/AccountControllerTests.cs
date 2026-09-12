// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using AwesomeAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using StigviddAPI;
using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using WebDataContracts.RequestModels.Account;

namespace IntegrationTests.AccountController;

public class AccountControllerTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string RegisterUrl = "/api/v1/account/register";
    private const string ForgotPasswordUrl = "/api/v1/account/forgot-password";
    private const string VerifyEmailUrl = "/api/v1/account/verify-email";
    private const string ResendVerificationUrl = "/api/v1/account/resend-verification";
    private const string KeycloakSubjectId = "kc-subject-id";

    // A nickname seeded by Utilities.GetSeedingUsers (User 1) — taken, so registration is rejected.
    private const string TakenNickName = "NaturElskaren";

    // A subject id seeded by Utilities.GetSeedingUsers — it already has a StigVidd record.
    private const string SeededSubjectId = "firebase-uid-12345";

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
        _factory.KeycloakAdminMock
            .Setup(k => k.ActivateVerifiedUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        SeedVerificationTemplate();
    }

    // Registration now sends mail, and the production template arrives via the migration's
    // InsertData -- which no test applies, because the suite builds its schema with
    // EnsureCreated. Without this every register would fail on an unknown template key.
    private void SeedVerificationTemplate()
    {
        using var db = Db();

        if (db.MailTemplates.Any(t => t.Key == "verify-email" && t.Language == "sv"))
            return;

        db.MailTemplates.Add(new MailTemplate
        {
            Key = "verify-email",
            Language = "sv",
            Subject = "Bekräfta din e-postadress hos Stigvidd",
            BodyHtml = "<p>Hej {{NickName}},</p><p>{{VerificationUrl}}</p><p>{{VerificationCode}}</p>",
            BodyText = "Hej {{NickName}},\n{{VerificationUrl}}\n{{VerificationCode}}",
        });

        db.SaveChanges();
    }

    private StigViddDbContext Db() =>
        _factory.Services.GetRequiredService<IDbContextFactory<StigViddDbContext>>().CreateDbContext();

    /// <summary>The mail body is the only place the raw token and code exist, exactly as it is
    /// for a real user -- the database holds only their hashes.</summary>
    private sealed record Challenge(string Token, string Code);

    private async Task<Challenge> RegisterAndReadChallengeAsync(HttpClient client, string email, string nickName)
    {
        var response = await client.PostAsJsonAsync(
            RegisterUrl,
            new RegisterRequest { Email = email, NickName = nickName, Password = "Password123!" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        using var db = Db();
        var mail = db.OutboxEmails.Single(e => e.ToAddress == email && e.TemplateKey == "verify-email");

        // The seeded BodyText is three lines: greeting, URL, code. Pulling the code off its
        // own line rather than by a \d{6} match matters -- the base64url token on the line
        // above can itself contain six digits between two non-word characters.
        var lines = mail.BodyText.Split('\n', StringSplitOptions.TrimEntries);

        var token = Regex.Match(mail.BodyText, "token=([^\\s<]+)").Groups[1].Value;
        var code = lines[^1];

        token.Should().NotBeEmpty();
        code.Should().MatchRegex("^[0-9]{6}$");

        return new Challenge(Uri.UnescapeDataString(token), code);
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
    public async Task Register_WhenKeycloakReportsConflict_ReturnsTheEmailConflictCode()
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
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Trim('"').Should().Be(StigviddAPI.Controllers.AccountController.EmailTakenCode);
    }

    [Fact]
    public async Task Register_WhenNickNameIsTaken_ReturnsTheNickNameConflictCode()
    {
        // Arrange: only the nickname collides, and it is checked before provisioning.
        var client = _factory.CreateClient();
        var request = new RegisterRequest
        {
            Email = "nickclash@test.local",
            NickName = TakenNickName,
            Password = "Password123!",
        };

        // Act
        var response = await client.PostAsJsonAsync(RegisterUrl, request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Trim('"').Should().Be(StigviddAPI.Controllers.AccountController.NickNameTakenCode);
        _factory.KeycloakAdminMock.Verify(
            k => k.CreateUserAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Register_WhenDbCreateFails_RollsBackTheKeycloakUser()
    {
        // Arrange: Keycloak hands back a subject id the DB already holds, so the insert fails after
        // provisioning.
        _factory.KeycloakAdminMock
            .Setup(k => k.CreateUserAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(SeededSubjectId);
        var client = _factory.CreateClient();
        var request = new RegisterRequest
        {
            Email = "rollback@test.local",
            NickName = "RollbackNick",
            Password = "Password123!",
        };

        // Act
        var response = await client.PostAsJsonAsync(RegisterUrl, request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        _factory.KeycloakAdminMock.Verify(
            k => k.DeleteUserAsync(SeededSubjectId, It.IsAny<CancellationToken>()),
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

    [Fact]
    public async Task Register_WhenValid_QueuesTheVerificationMail()
    {
        // Arrange
        var client = _factory.CreateClient();
        var request = new RegisterRequest
        {
            Email = "mailme@test.local",
            NickName = "MailMe",
            Password = "Password123!",
        };

        // Act
        var response = await client.PostAsJsonAsync(RegisterUrl, request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        using var db = Db();
        var mail = db.OutboxEmails.SingleOrDefault(e => e.ToAddress == request.Email);

        mail.Should().NotBeNull();
        mail!.TemplateKey.Should().Be("verify-email");
        mail.Status.Should().Be(OutboxEmailStatus.Pending);
        mail.BodyText.Should().Contain("/api/v1/account/verify-email?token=");
    }

    [Fact]
    public async Task Register_WhenValid_LeavesTheUserUnverified()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        await RegisterAndReadChallengeAsync(client, "unverified@test.local", "StillWaiting");

        // Assert: the DB marker is null until the challenge is met. What actually blocks the
        // login is the Keycloak user being disabled, which KeycloakAdminRepositoryTests covers.
        using var db = Db();
        db.Users.Single(u => u.Email == "unverified@test.local").EmailVerifiedAt.Should().BeNull();
    }

    [Fact]
    public async Task VerifyEmailByLink_WithTheTokenFromTheMail_EnablesTheKeycloakUser()
    {
        // Arrange
        var client = _factory.CreateClient();
        var challenge = await RegisterAndReadChallengeAsync(client, "bylink@test.local", "ByLink");

        // Act
        var response = await client.GetAsync(
            $"{VerifyEmailUrl}?token={Uri.EscapeDataString(challenge.Token)}",
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.Should().Be("text/html");

        _factory.KeycloakAdminMock.Verify(
            k => k.ActivateVerifiedUserAsync(KeycloakSubjectId, It.IsAny<CancellationToken>()),
            Times.Once);

        using var db = Db();
        db.Users.Single(u => u.Email == "bylink@test.local").EmailVerifiedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task VerifyEmailByLink_WhenTheLinkIsUsedTwice_StillReportsSuccess()
    {
        // Arrange: a mail scanner following the link before the human does must not leave the
        // human staring at an error, so a consumed token for a verified user reads as success.
        var client = _factory.CreateClient();
        var challenge = await RegisterAndReadChallengeAsync(client, "twice@test.local", "TwiceOver");
        var url = $"{VerifyEmailUrl}?token={Uri.EscapeDataString(challenge.Token)}";

        await client.GetAsync(url, TestContext.Current.CancellationToken);

        // Act
        var second = await client.GetAsync(url, TestContext.Current.CancellationToken);

        // Assert
        second.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task VerifyEmailByLink_WithAnUnknownToken_ReturnsBadRequestAndEnablesNobody()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"{VerifyEmailUrl}?token=not-a-real-token", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        _factory.KeycloakAdminMock.Verify(
            k => k.ActivateVerifiedUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task VerifyEmailByCode_WithTheCodeFromTheMail_ReturnsNoContent()
    {
        // Arrange
        var client = _factory.CreateClient();
        var challenge = await RegisterAndReadChallengeAsync(client, "bycode@test.local", "ByCode");

        // Act
        var response = await client.PostAsJsonAsync(
            VerifyEmailUrl,
            new VerifyEmailRequest { Email = "bycode@test.local", Code = challenge.Code },
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        _factory.KeycloakAdminMock.Verify(
            k => k.ActivateVerifiedUserAsync(KeycloakSubjectId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task VerifyEmailByCode_WithTheWrongCode_ReturnsBadRequestAndEnablesNobody()
    {
        // Arrange
        var client = _factory.CreateClient();
        var challenge = await RegisterAndReadChallengeAsync(client, "wrongcode@test.local", "WrongCode");
        var wrong = challenge.Code == "000000" ? "111111" : "000000";

        // Act
        var response = await client.PostAsJsonAsync(
            VerifyEmailUrl,
            new VerifyEmailRequest { Email = "wrongcode@test.local", Code = wrong },
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        _factory.KeycloakAdminMock.Verify(
            k => k.ActivateVerifiedUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ResendVerification_ForAnUnknownEmail_StillReturnsNoContent()
    {
        // Arrange: the endpoint is unauthenticated, so it must not reveal which addresses exist.
        var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsJsonAsync(
            ResendVerificationUrl,
            new ResendVerificationRequest { Email = "nobody@test.local" },
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var db = Db();
        db.OutboxEmails.Any(e => e.ToAddress == "nobody@test.local").Should().BeFalse();
    }
}
