// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using StigviddAPI;
using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using WebDataContracts.RequestModels.Account;

namespace IntegrationTests.AccountController;

/// <summary>
/// The whole reset flow against the real host: ask, read the mail out of the outbox, open the
/// link, post a new password, and check Keycloak was actually told. The mail is the only place
/// the raw token exists, so reading it back out of <c>OutboxEmails</c> is not a shortcut — it
/// is the same thing a user does.
/// </summary>
public class PasswordResetIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string ForgotPasswordUrl = "/api/v1/account/forgot-password";
    private const string ResetPasswordUrl = "/api/v1/account/reset-password";

    // Seeded by Utilities.GetSeedingUsers (User 1).
    private const string SeededEmail = "natur@example.local";
    private const string SeededSubjectId = "firebase-uid-12345";

    private const string NewPassword = "ett-alldeles-nytt-losenord";

    public PasswordResetIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();

        _factory.KeycloakAdminMock.Reset();
        _factory.KeycloakAdminMock
            .Setup(k => k.SetPasswordAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        SeedResetTemplate();
        ClearOutbox();
    }

    // The production template arrives via the migration's InsertData -- which no test applies,
    // because the suite builds its schema with EnsureCreated. Without this every reset request
    // would fail on an unknown template key.
    private void SeedResetTemplate()
    {
        using var db = Db();

        if (db.MailTemplates.Any(t => t.Key == "reset-password" && t.Language == "sv"))
            return;

        db.MailTemplates.Add(new MailTemplate
        {
            Key = "reset-password",
            Language = "sv",
            Subject = "Återställ ditt lösenord hos Stigvidd",
            BodyHtml = "<p>Hej {{NickName}},</p><p>{{ResetUrl}}</p>",
            BodyText = "Hej {{NickName}},\n{{ResetUrl}}",
        });

        db.SaveChanges();
    }

    /// <summary>The factory is shared across the class, so a previous test's mail and tokens
    /// would otherwise make "exactly one mail" ambiguous.</summary>
    private void ClearOutbox()
    {
        using var db = Db();
        db.OutboxEmails.RemoveRange(db.OutboxEmails.Where(e => e.TemplateKey == "reset-password"));
        db.PasswordResetTokens.RemoveRange(db.PasswordResetTokens);
        db.SaveChanges();
    }

    private StigViddDbContext Db() =>
        _factory.Services.GetRequiredService<IDbContextFactory<StigViddDbContext>>().CreateDbContext();

    /// <summary>Asks for a reset and returns the raw token out of the mail that was queued.</summary>
    private async Task<string> RequestResetAsync(string email = SeededEmail)
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            ForgotPasswordUrl,
            new ForgotPasswordRequest { Email = email },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var db = Db();
        var mail = db.OutboxEmails.Single(e => e.ToAddress == email && e.TemplateKey == "reset-password");

        var token = Regex.Match(mail.BodyText, "token=([^\\s<]+)").Groups[1].Value;
        token.Should().NotBeEmpty();

        return Uri.UnescapeDataString(token);
    }

    private static FormUrlEncodedContent ResetForm(string token, string password, string? confirm = null) =>
        new(new Dictionary<string, string>
        {
            ["token"] = token,
            ["newPassword"] = password,
            ["confirmPassword"] = confirm ?? password,
        });

    [Fact]
    public async Task ForgotPassword_ForAKnownEmail_QueuesOneMailCarryingTheLink()
    {
        // Act
        var token = await RequestResetAsync();

        // Assert
        using var db = Db();
        var mail = db.OutboxEmails.Single(e => e.TemplateKey == "reset-password");
        mail.BodyText.Should().Contain("/api/v1/account/reset-password?token=");
        mail.ToAddress.Should().Be(SeededEmail);

        // The database holds a hash of what the mail carries, never the token itself.
        var stored = db.PasswordResetTokens.Single();
        stored.TokenHash.Should().NotBe(token);
        stored.ConsumedAt.Should().BeNull();
    }

    [Fact]
    public async Task ForgotPassword_ForAnUnknownEmail_Returns204AndQueuesNothing()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsJsonAsync(
            ForgotPasswordUrl,
            new ForgotPasswordRequest { Email = "nobody@example.local" },
            TestContext.Current.CancellationToken);

        // Assert — identical to the known-address answer, which is the point.
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var db = Db();
        db.OutboxEmails.Any(e => e.TemplateKey == "reset-password").Should().BeFalse();
    }

    [Fact]
    public async Task GetResetPassword_WithALiveToken_ServesTheFormWithoutConsumingIt()
    {
        // Arrange
        var token = await RequestResetAsync();
        var client = _factory.CreateClient();

        // Act — this is what a mail scanner's prefetch does.
        var response = await client.GetAsync(
            $"{ResetPasswordUrl}?token={Uri.EscapeDataString(token)}",
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.Should().Be("text/html");

        var html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        html.Should().Contain("name=\"newPassword\"");
        html.Should().Contain("name=\"token\"");

        // The token must survive the prefetch, or the human's click always lands on a dead link.
        using var db = Db();
        db.PasswordResetTokens.Single().ConsumedAt.Should().BeNull();
    }

    [Fact]
    public async Task GetResetPassword_IsNotCachedAndLeaksNoReferrer()
    {
        // Arrange — the page carries the token in a hidden field and in the URL that reached it.
        var token = await RequestResetAsync();
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync(
            $"{ResetPasswordUrl}?token={Uri.EscapeDataString(token)}",
            TestContext.Current.CancellationToken);

        // Assert
        response.Headers.CacheControl!.NoStore.Should().BeTrue();
        response.Headers.GetValues("Referrer-Policy").Should().ContainSingle().Which.Should().Be("no-referrer");
        response.Headers.GetValues("Content-Security-Policy").Should().ContainSingle()
            .Which.Should().Contain("form-action 'self'").And.Contain("frame-ancestors 'none'");
    }

    [Fact]
    public async Task GetResetPassword_WithAnUnknownToken_IsRejected()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync(
            $"{ResetPasswordUrl}?token=not-a-real-token",
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        response.Content.Headers.ContentType!.MediaType.Should().Be("text/html");
    }

    [Fact]
    public async Task PostResetPassword_WithALiveToken_SetsThePasswordInKeycloakAndSpendsTheLink()
    {
        // Arrange
        var token = await RequestResetAsync();
        var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsync(
            ResetPasswordUrl,
            ResetForm(token, NewPassword),
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Keycloak owns the password -- this call is the only thing that actually changes it.
        _factory.KeycloakAdminMock.Verify(
            k => k.SetPasswordAsync(SeededSubjectId, NewPassword, It.IsAny<CancellationToken>()),
            Times.Once);

        using var db = Db();
        db.PasswordResetTokens.Single().ConsumedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task PostResetPassword_Twice_DoesNotChangeThePasswordASecondTime()
    {
        // Arrange — the double-click and the replay are the same request.
        var token = await RequestResetAsync();
        var client = _factory.CreateClient();

        await client.PostAsync(ResetPasswordUrl, ResetForm(token, NewPassword), TestContext.Current.CancellationToken);

        // Act
        var second = await client.PostAsync(
            ResetPasswordUrl,
            ResetForm(token, "yet-another-password"),
            TestContext.Current.CancellationToken);

        // Assert
        second.StatusCode.Should().Be(HttpStatusCode.Gone);
        _factory.KeycloakAdminMock.Verify(
            k => k.SetPasswordAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task PostResetPassword_WithMismatchedFields_ReRendersTheFormAndTouchesNothing()
    {
        // Arrange
        var token = await RequestResetAsync();
        var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsync(
            ResetPasswordUrl,
            ResetForm(token, NewPassword, "something-else"),
            TestContext.Current.CancellationToken);

        // Assert — HTML, not a JSON ProblemDetails: this is a browser, and [ApiController]'s
        // automatic 400 would hand it a JSON blob.
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        response.Content.Headers.ContentType!.MediaType.Should().Be("text/html");

        var html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        html.Should().Contain("name=\"newPassword\"", "the user must get the form back, not a dead end");

        _factory.KeycloakAdminMock.Verify(
            k => k.SetPasswordAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);

        using var db = Db();
        db.PasswordResetTokens.Single().ConsumedAt.Should().BeNull();
    }

    [Fact]
    public async Task PostResetPassword_WhenKeycloakRefusesThePassword_ReRendersTheFormAndKeepsTheLink()
    {
        // Arrange — the realm password policy is not in this repository, so this is the only
        // way a weak password is ever refused.
        _factory.KeycloakAdminMock
            .Setup(k => k.SetPasswordAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var token = await RequestResetAsync();
        var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsync(
            ResetPasswordUrl,
            ResetForm(token, "weak"),
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        html.Should().Contain("name=\"newPassword\"");

        using var db = Db();
        db.PasswordResetTokens.Single().ConsumedAt.Should().BeNull(
            "a refused password must leave the link usable for a stronger one");
    }

    [Fact]
    public async Task RequestingTwice_RetiresTheFirstLink()
    {
        // Arrange
        var first = await RequestResetAsync();

        // The cooldown is measured from the last issue, so move it out of the way.
        using (var db = Db())
        {
            foreach (var row in db.PasswordResetTokens)
                row.CreatedAt = DateTime.UtcNow.AddMinutes(-10);
            db.SaveChanges();
        }

        using (var db = Db())
        {
            db.OutboxEmails.RemoveRange(db.OutboxEmails.Where(e => e.TemplateKey == "reset-password"));
            db.SaveChanges();
        }

        var second = await RequestResetAsync();
        second.Should().NotBe(first);

        var client = _factory.CreateClient();

        // Act — the superseded link.
        var response = await client.PostAsync(
            ResetPasswordUrl,
            ResetForm(first, NewPassword),
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Gone);
        _factory.KeycloakAdminMock.Verify(
            k => k.SetPasswordAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
