// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests.ServiceTests;

public class PasswordResetServiceTests
{
    private const string Email = "vandrare@example.local";
    private const string NickName = "Vandraren";
    private const string SubjectId = "kc-subject-id";
    private const int UserId = 7;
    private const int TokenId = 42;
    private const string BaseUrl = "https://api.test.local";
    private const string NewPassword = "ett-nytt-losenord";

    private static User TestUser() => new()
    {
        Id = UserId,
        Email = Email,
        NickName = NickName,
        SubjectId = SubjectId,
    };

    /// <summary>A bare mock returns a null Result, which is not a state the real service can
    /// meet, so every mock these tests build starts from a succeeding baseline.</summary>
    private static Mock<IMailOutboxService> SucceedingMail()
    {
        var mail = new Mock<IMailOutboxService>();

        mail.Setup(m => m.EnqueueAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string?>>(),
                It.IsAny<CancellationToken>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .ReturnsAsync(Result.Ok("mail-identifier"));

        return mail;
    }

    private static Mock<IPasswordResetTokenRepository> SucceedingTokens(User? user = null)
    {
        var tokens = new Mock<IPasswordResetTokenRepository>();

        tokens.Setup(t => t.GetUserByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<User>.Success(user ?? TestUser()));

        // No previous reset, so nothing is inside a cooldown.
        tokens.Setup(t => t.GetLatestForUserAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<PasswordResetToken>.NotFound());

        tokens.Setup(t => t.ReplaceOutstandingAsync(It.IsAny<PasswordResetToken>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        tokens.Setup(t => t.ConsumeAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        return tokens;
    }

    private static Mock<IKeycloakAdminRepository> AcceptingKeycloak()
    {
        var keycloak = new Mock<IKeycloakAdminRepository>();

        keycloak.Setup(k => k.SetPasswordAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        return keycloak;
    }

    private static PasswordResetService Build(
        Mock<IPasswordResetTokenRepository>? tokens = null,
        Mock<IKeycloakAdminRepository>? keycloak = null,
        Mock<IMailOutboxService>? mail = null,
        Dictionary<string, string?>? settings = null)
    {
        // Only defaulted, never re-setup: a Setup here would silently replace one a test had
        // already put on the mock it passed in, callbacks and all.
        tokens ??= SucceedingTokens();
        keycloak ??= AcceptingKeycloak();
        mail ??= SucceedingMail();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(settings ?? new Dictionary<string, string?>())
            .Build();

        return new PasswordResetService(
            tokens.Object,
            keycloak.Object,
            mail.Object,
            configuration,
            NullLogger<PasswordResetService>.Instance);
    }

    /// <summary>A live row whose hash matches whatever the service looked up.</summary>
    private static PasswordResetToken LiveToken() => new()
    {
        Id = TokenId,
        UserId = UserId,
        TokenHash = "irrelevant-the-mock-matches-any-hash",
        ExpiresAt = DateTime.UtcNow.AddHours(1),
        User = TestUser(),
    };

    private static Mock<IPasswordResetTokenRepository> TokensReturning(PasswordResetToken? token)
    {
        var tokens = SucceedingTokens();

        tokens.Setup(t => t.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(token is null
                ? RepositoryResult<PasswordResetToken>.NotFound()
                : RepositoryResult<PasswordResetToken>.Success(token));

        return tokens;
    }

    #region Issuing

    [Fact]
    public async Task IssueAndSendAsync_ForAnUnknownEmail_SucceedsWithoutSendingAnything()
    {
        // Arrange — the caller is unauthenticated, so any difference between a known and an
        // unknown address is a user-enumeration oracle.
        var tokens = SucceedingTokens();
        tokens.Setup(t => t.GetUserByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<User>.NotFound());
        var mail = SucceedingMail();

        // Act
        var result = await Build(tokens, mail: mail)
            .IssueAndSendAsync("nobody@example.local", BaseUrl, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        mail.Verify(
            m => m.EnqueueAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string?>>(),
                It.IsAny<CancellationToken>(), It.IsAny<string?>(), It.IsAny<string?>()),
            Times.Never);
    }

    [Fact]
    public async Task IssueAndSendAsync_InsideTheCooldown_SendsNothingAndStillSucceeds()
    {
        // Arrange
        var tokens = SucceedingTokens();
        tokens.Setup(t => t.GetLatestForUserAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<PasswordResetToken>.Success(new PasswordResetToken
            {
                Id = TokenId,
                UserId = UserId,
                TokenHash = "previous",
                ExpiresAt = DateTime.UtcNow.AddHours(1),
                CreatedAt = DateTime.UtcNow.AddSeconds(-5),
            }));
        var mail = SucceedingMail();

        // Act
        var result = await Build(tokens, mail: mail)
            .IssueAndSendAsync(Email, BaseUrl, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        mail.Verify(
            m => m.EnqueueAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string?>>(),
                It.IsAny<CancellationToken>(), It.IsAny<string?>(), It.IsAny<string?>()),
            Times.Never);
    }

    [Fact]
    public async Task IssueAndSendAsync_StoresOnlyAHashAndMailsTheRawTokenOnce()
    {
        // Arrange — the whole security model is that the raw token exists only in the mail.
        var tokens = SucceedingTokens();
        PasswordResetToken? stored = null;
        tokens.Setup(t => t.ReplaceOutstandingAsync(It.IsAny<PasswordResetToken>(), It.IsAny<CancellationToken>()))
            .Callback<PasswordResetToken, CancellationToken>((t, _) => stored = t)
            .ReturnsAsync(RepositoryResult.Success());

        var mail = SucceedingMail();
        IReadOnlyDictionary<string, string?>? model = null;
        mail.Setup(m => m.EnqueueAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string?>>(),
                It.IsAny<CancellationToken>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .Callback<string, string, IReadOnlyDictionary<string, string?>, CancellationToken, string?, string?>(
                (_, _, m, _, _, _) => model = m)
            .ReturnsAsync(Result.Ok("mail-identifier"));

        // Act
        var result = await Build(tokens, mail: mail)
            .IssueAndSendAsync(Email, BaseUrl, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        stored.Should().NotBeNull();
        model.Should().NotBeNull();

        var resetUrl = model!["ResetUrl"]!;
        resetUrl.Should().StartWith($"{BaseUrl}/api/v1/account/reset-password?token=");

        var rawToken = resetUrl.Split("token=")[1];
        rawToken.Should().NotBeNullOrWhiteSpace();
        stored!.TokenHash.Should().NotBe(
            rawToken,
            "the database must hold a hash — a dump that contains the raw token is an account takeover");
    }

    [Fact]
    public async Task IssueAndSendAsync_PrefersTheConfiguredBaseUrlOverTheRequestOrigin()
    {
        // Arrange — there is no forwarded-headers middleware, so the request origin is http://
        // behind the proxy. PasswordReset:BaseUrl is what keeps the mailed link https://.
        var mail = SucceedingMail();
        IReadOnlyDictionary<string, string?>? model = null;
        mail.Setup(m => m.EnqueueAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string?>>(),
                It.IsAny<CancellationToken>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .Callback<string, string, IReadOnlyDictionary<string, string?>, CancellationToken, string?, string?>(
                (_, _, m, _, _, _) => model = m)
            .ReturnsAsync(Result.Ok("mail-identifier"));

        var settings = new Dictionary<string, string?>
        {
            ["PasswordReset:BaseUrl"] = "https://configured.test.local",
        };

        // Act
        await Build(mail: mail, settings: settings)
            .IssueAndSendAsync(Email, "http://insecure.internal", TestContext.Current.CancellationToken);

        // Assert
        model!["ResetUrl"].Should().StartWith("https://configured.test.local/");
    }

    [Fact]
    public async Task IssueAndSendAsync_WhenTheMailCannotBeQueued_Fails()
    {
        // Arrange — an unknown template or a missing placeholder is a bug here, and enqueue
        // time is the last moment anyone is listening.
        var mail = new Mock<IMailOutboxService>();
        mail.Setup(m => m.EnqueueAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string?>>(),
                It.IsAny<CancellationToken>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .ReturnsAsync(Result.Fail<string>(new Message(404, "no such template")));

        // Act
        var result = await Build(mail: mail)
            .IssueAndSendAsync(Email, BaseUrl, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
    }

    #endregion

    #region Validating — the GET path

    [Fact]
    public async Task ValidateAsync_ForALiveToken_IsValidAndConsumesNothing()
    {
        // Arrange — mail scanners and corporate link-prefetchers follow the link before the
        // human does. If the GET consumed, the real click would always land on a dead link.
        var tokens = TokensReturning(LiveToken());

        // Act
        var result = await Build(tokens).ValidateAsync("raw", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().Be(PasswordResetOutcome.Valid);
        tokens.Verify(
            t => t.ConsumeAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()),
            Times.Never,
            "a prefetched GET must leave the link usable for the human who clicks it next");
    }

    [Fact]
    public async Task ValidateAsync_ForAnUnknownToken_IsInvalid()
    {
        var result = await Build(TokensReturning(null))
            .ValidateAsync("raw", TestContext.Current.CancellationToken);

        result.Value.Should().Be(PasswordResetOutcome.Invalid);
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task ValidateAsync_ForASpentOrExpiredToken_IsExpired(bool consumed, bool expired)
    {
        // Arrange — both report Expired rather than Invalid so the page can say "ask for a new
        // mail" instead of "this link is wrong".
        var token = LiveToken();
        if (consumed) token.ConsumedAt = DateTime.UtcNow.AddMinutes(-1);
        if (expired) token.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);

        // Act
        var result = await Build(TokensReturning(token))
            .ValidateAsync("raw", TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().Be(PasswordResetOutcome.Expired);
    }

    #endregion

    #region Resetting — the POST path

    [Fact]
    public async Task ResetAsync_ForALiveToken_SetsThePasswordAndSpendsTheLink()
    {
        // Arrange
        var tokens = TokensReturning(LiveToken());
        var keycloak = AcceptingKeycloak();

        // Act
        var result = await Build(tokens, keycloak)
            .ResetAsync("raw", NewPassword, TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().Be(PasswordResetOutcome.Reset);
        keycloak.Verify(k => k.SetPasswordAsync(SubjectId, NewPassword, It.IsAny<CancellationToken>()), Times.Once);
        tokens.Verify(t => t.ConsumeAsync(TokenId, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ResetAsync_WhenKeycloakRejectsThePassword_LeavesTheTokenUsable()
    {
        // Arrange — the realm password policy is not in this repository, so a refusal is an
        // ordinary answer. The user is in front of the form and must be able to try a stronger
        // password without asking for a whole new mail.
        var tokens = TokensReturning(LiveToken());
        var keycloak = new Mock<IKeycloakAdminRepository>();
        keycloak.Setup(k => k.SetPasswordAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        // Act
        var result = await Build(tokens, keycloak)
            .ResetAsync("raw", "weak", TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().Be(PasswordResetOutcome.WeakPassword);
        tokens.Verify(
            t => t.ConsumeAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()),
            Times.Never,
            "burning the link on a rejected password would strand the user mid-reset");
    }

    [Fact]
    public async Task ResetAsync_WithAlreadySpentToken_DoesNotTouchKeycloak()
    {
        // Arrange — this is the double-submit and the replay: both must be inert.
        var token = LiveToken();
        token.ConsumedAt = DateTime.UtcNow.AddMinutes(-1);
        var keycloak = AcceptingKeycloak();

        // Act
        var result = await Build(TokensReturning(token), keycloak)
            .ResetAsync("raw", NewPassword, TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().Be(PasswordResetOutcome.Expired);
        keycloak.Verify(
            k => k.SetPasswordAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ResetAsync_WhenKeycloakThrows_FailsRatherThanConsuming()
    {
        // Arrange
        var tokens = TokensReturning(LiveToken());
        var keycloak = new Mock<IKeycloakAdminRepository>();
        keycloak.Setup(k => k.SetPasswordAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("Keycloak unavailable"));

        // Act
        var result = await Build(tokens, keycloak)
            .ResetAsync("raw", NewPassword, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        tokens.Verify(
            t => t.ConsumeAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ResetAsync_WithAnEmptyToken_IsInvalidAndTouchesNothing()
    {
        // Arrange — a scanner that blind-POSTs the form must not reach Keycloak.
        var tokens = TokensReturning(null);
        var keycloak = AcceptingKeycloak();

        // Act
        var result = await Build(tokens, keycloak)
            .ResetAsync(string.Empty, NewPassword, TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().Be(PasswordResetOutcome.Invalid);
        keycloak.Verify(
            k => k.SetPasswordAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
        tokens.Verify(
            t => t.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    #endregion
}
