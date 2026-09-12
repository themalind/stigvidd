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

public class EmailVerificationServiceTests
{
    private const string Email = "vandrare@example.local";
    private const string NickName = "Vandraren";
    private const string SubjectId = "kc-subject-id";
    private const int UserId = 7;
    private const string BaseUrl = "https://api.test.local";

    private static User TestUser(DateTime? verifiedAt = null) => new()
    {
        Id = UserId,
        Email = Email,
        NickName = NickName,
        SubjectId = SubjectId,
        EmailVerifiedAt = verifiedAt,
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

    private static Mock<IEmailVerificationTokenRepository> SucceedingTokens()
    {
        var tokens = new Mock<IEmailVerificationTokenRepository>();

        tokens.Setup(t => t.ReplaceOutstandingAsync(It.IsAny<EmailVerificationToken>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        return tokens;
    }

    private static EmailVerificationService Build(
        Mock<IEmailVerificationTokenRepository>? tokens = null,
        Mock<IKeycloakAdminRepository>? keycloak = null,
        Mock<IMailOutboxService>? mail = null,
        Dictionary<string, string?>? settings = null)
    {
        // Only defaulted, never re-setup: a Setup here would silently replace one a test had
        // already put on the mock it passed in, callbacks and all.
        tokens ??= SucceedingTokens();
        keycloak ??= new Mock<IKeycloakAdminRepository>();
        mail ??= SucceedingMail();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(settings ?? new Dictionary<string, string?>())
            .Build();

        return new EmailVerificationService(
            tokens.Object,
            keycloak.Object,
            mail.Object,
            configuration,
            NullLogger<EmailVerificationService>.Instance);
    }

    // ---- Issuing --------------------------------------------------------------------

    [Fact]
    public async Task IssueAndSendAsync_StoresOnlyHashesAndMailsTheRawSecrets()
    {
        // Arrange
        var tokens = SucceedingTokens();
        var mail = SucceedingMail();

        EmailVerificationToken? stored = null;
        IReadOnlyDictionary<string, string?>? model = null;

        tokens.Setup(t => t.ReplaceOutstandingAsync(It.IsAny<EmailVerificationToken>(), It.IsAny<CancellationToken>()))
            .Callback<EmailVerificationToken, CancellationToken>((t, _) => stored = t)
            .ReturnsAsync(RepositoryResult.Success());

        mail.Setup(m => m.EnqueueAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string?>>(),
                It.IsAny<CancellationToken>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .Callback<string, string, IReadOnlyDictionary<string, string?>, CancellationToken, string?, string?>(
                (_, _, m, _, _, _) => model = m)
            .ReturnsAsync(Result.Ok("mail-identifier"));

        // Act
        var result = await Build(tokens, mail: mail)
            .IssueAndSendAsync(UserId, Email, NickName, BaseUrl, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        stored.Should().NotBeNull();
        model.Should().NotBeNull();

        var rawCode = model!["VerificationCode"];
        var rawUrl = model["VerificationUrl"];

        rawCode.Should().MatchRegex("^[0-9]{6}$");
        rawUrl.Should().StartWith($"{BaseUrl}/api/v1/account/verify-email?token=");

        // The point of the design: what is mailed is never what is stored.
        stored!.CodeHash.Should().NotBe(rawCode);
        stored.TokenHash.Should().NotBeEmpty();
        rawUrl.Should().NotContain(stored.TokenHash);
    }

    [Fact]
    public async Task IssueAndSendAsync_WhenTheMailCannotBeQueued_Fails()
    {
        // Arrange: an unknown template or a missing placeholder is a bug here, and enqueue time
        // is the last moment anyone is listening. It must not be swallowed.
        var mail = new Mock<IMailOutboxService>();
        mail.Setup(m => m.EnqueueAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string?>>(),
                It.IsAny<CancellationToken>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .ReturnsAsync(Result.Fail<string>(new Message(404, "No such template.")));

        // Act
        var result = await Build(mail: mail)
            .IssueAndSendAsync(UserId, Email, NickName, BaseUrl, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task IssueAndSendAsync_PrefersTheConfiguredBaseUrlOverTheRequestOrigin()
    {
        // Arrange
        var mail = new Mock<IMailOutboxService>();
        IReadOnlyDictionary<string, string?>? model = null;

        mail.Setup(m => m.EnqueueAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string?>>(),
                It.IsAny<CancellationToken>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .Callback<string, string, IReadOnlyDictionary<string, string?>, CancellationToken, string?, string?>(
                (_, _, m, _, _, _) => model = m)
            .ReturnsAsync(Result.Ok("mail-identifier"));

        var settings = new Dictionary<string, string?>
        {
            ["EmailVerification:BaseUrl"] = "https://configured.example/",
        };

        // Act
        await Build(mail: mail, settings: settings)
            .IssueAndSendAsync(UserId, Email, NickName, BaseUrl, CancellationToken.None);

        // Assert
        model!["VerificationUrl"].Should().StartWith("https://configured.example/api/v1/account/verify-email?token=");
    }

    // ---- Verifying by link ----------------------------------------------------------

    /// <summary>Issues a challenge through the service so the test holds the raw secrets, then
    /// hands back the row the repository was asked to store.</summary>
    private static async Task<(EmailVerificationToken Stored, string Url, string Code)> IssueAsync(
        Mock<IEmailVerificationTokenRepository> tokens)
    {
        var mail = new Mock<IMailOutboxService>();
        IReadOnlyDictionary<string, string?>? model = null;

        mail.Setup(m => m.EnqueueAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string?>>(),
                It.IsAny<CancellationToken>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .Callback<string, string, IReadOnlyDictionary<string, string?>, CancellationToken, string?, string?>(
                (_, _, m, _, _, _) => model = m)
            .ReturnsAsync(Result.Ok("mail-identifier"));

        EmailVerificationToken? stored = null;
        tokens.Setup(t => t.ReplaceOutstandingAsync(It.IsAny<EmailVerificationToken>(), It.IsAny<CancellationToken>()))
            .Callback<EmailVerificationToken, CancellationToken>((t, _) => stored = t)
            .ReturnsAsync(RepositoryResult.Success());

        await Build(tokens, mail: mail).IssueAndSendAsync(UserId, Email, NickName, BaseUrl, CancellationToken.None);

        stored!.User = TestUser();
        return (stored, model!["VerificationUrl"]!, model["VerificationCode"]!);
    }

    private static string TokenFromUrl(string url) =>
        Uri.UnescapeDataString(url[(url.IndexOf("token=", StringComparison.Ordinal) + "token=".Length)..]);

    [Fact]
    public async Task VerifyByTokenAsync_WithTheIssuedToken_VerifiesAndEnablesTheKeycloakUser()
    {
        // Arrange
        var tokens = new Mock<IEmailVerificationTokenRepository>();
        var keycloak = new Mock<IKeycloakAdminRepository>();
        var (stored, url, _) = await IssueAsync(tokens);

        tokens.Setup(t => t.GetByTokenHashAsync(stored.TokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<EmailVerificationToken>.Success(stored));
        tokens.Setup(t => t.ConsumeAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(tokens, keycloak)
            .VerifyByTokenAsync(TokenFromUrl(url), CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().Be(EmailVerificationOutcome.Verified);
        keycloak.Verify(k => k.ActivateVerifiedUserAsync(SubjectId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task VerifyByTokenAsync_WhenExpired_DoesNotEnableTheKeycloakUser()
    {
        // Arrange
        var tokens = new Mock<IEmailVerificationTokenRepository>();
        var keycloak = new Mock<IKeycloakAdminRepository>();
        var (stored, url, _) = await IssueAsync(tokens);

        stored.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);

        tokens.Setup(t => t.GetByTokenHashAsync(stored.TokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<EmailVerificationToken>.Success(stored));

        // Act
        var result = await Build(tokens, keycloak)
            .VerifyByTokenAsync(TokenFromUrl(url), CancellationToken.None);

        // Assert
        result.Value.Should().Be(EmailVerificationOutcome.Expired);
        keycloak.Verify(k => k.ActivateVerifiedUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        tokens.Verify(t => t.ConsumeAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task VerifyByTokenAsync_WhenAlreadyConsumedByAScanner_ReportsAlreadyVerified()
    {
        // Arrange: a link prefetcher followed the link, so the row is consumed and the user is
        // verified. The human clicking afterwards must not see an error.
        var tokens = new Mock<IEmailVerificationTokenRepository>();
        var (stored, url, _) = await IssueAsync(tokens);

        stored.ConsumedAt = DateTime.UtcNow.AddSeconds(-5);
        stored.User = TestUser(verifiedAt: DateTime.UtcNow.AddSeconds(-5));

        tokens.Setup(t => t.GetByTokenHashAsync(stored.TokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<EmailVerificationToken>.Success(stored));

        // Act
        var result = await Build(tokens).VerifyByTokenAsync(TokenFromUrl(url), CancellationToken.None);

        // Assert
        result.Value.Should().Be(EmailVerificationOutcome.AlreadyVerified);
    }

    [Fact]
    public async Task VerifyByTokenAsync_WhenConsumedButTheUserIsNotVerified_IsInvalid()
    {
        // Arrange: a retired row — the user asked for a new mail, so this token is dead.
        var tokens = new Mock<IEmailVerificationTokenRepository>();
        var (stored, url, _) = await IssueAsync(tokens);

        stored.ConsumedAt = DateTime.UtcNow.AddSeconds(-5);
        stored.User = TestUser();

        tokens.Setup(t => t.GetByTokenHashAsync(stored.TokenHash, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<EmailVerificationToken>.Success(stored));

        // Act
        var result = await Build(tokens).VerifyByTokenAsync(TokenFromUrl(url), CancellationToken.None);

        // Assert
        result.Value.Should().Be(EmailVerificationOutcome.Invalid);
    }

    [Fact]
    public async Task VerifyByTokenAsync_WithAnUnknownToken_IsInvalid()
    {
        // Arrange
        var tokens = new Mock<IEmailVerificationTokenRepository>();
        tokens.Setup(t => t.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<EmailVerificationToken>.NotFound());

        // Act
        var result = await Build(tokens).VerifyByTokenAsync("nonsense", CancellationToken.None);

        // Assert
        result.Value.Should().Be(EmailVerificationOutcome.Invalid);
    }

    // ---- Verifying by code ----------------------------------------------------------

    [Fact]
    public async Task VerifyByCodeAsync_WithTheIssuedCode_Verifies()
    {
        // Arrange
        var tokens = new Mock<IEmailVerificationTokenRepository>();
        var keycloak = new Mock<IKeycloakAdminRepository>();
        var (stored, _, code) = await IssueAsync(tokens);

        tokens.Setup(t => t.GetUserByEmailAsync(Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<User>.Success(TestUser()));
        tokens.Setup(t => t.GetLatestForUserAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<EmailVerificationToken>.Success(stored));
        tokens.Setup(t => t.ConsumeAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(tokens, keycloak).VerifyByCodeAsync(Email, code, CancellationToken.None);

        // Assert
        result.Value.Should().Be(EmailVerificationOutcome.Verified);
        keycloak.Verify(k => k.ActivateVerifiedUserAsync(SubjectId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task VerifyByCodeAsync_WithAWrongCode_CountsAnAttemptAndDoesNotVerify()
    {
        // Arrange
        var tokens = new Mock<IEmailVerificationTokenRepository>();
        var keycloak = new Mock<IKeycloakAdminRepository>();
        var (stored, _, code) = await IssueAsync(tokens);

        tokens.Setup(t => t.GetUserByEmailAsync(Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<User>.Success(TestUser()));
        tokens.Setup(t => t.GetLatestForUserAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<EmailVerificationToken>.Success(stored));
        tokens.Setup(t => t.IncrementAttemptsAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var wrong = code == "000000" ? "111111" : "000000";

        // Act
        var result = await Build(tokens, keycloak).VerifyByCodeAsync(Email, wrong, CancellationToken.None);

        // Assert
        result.Value.Should().Be(EmailVerificationOutcome.Invalid);
        tokens.Verify(t => t.IncrementAttemptsAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Once);
        keycloak.Verify(k => k.ActivateVerifiedUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task VerifyByCodeAsync_OnceTheAttemptCapIsReached_RefusesEvenTheRightCode()
    {
        // Arrange: six digits is a million guesses without this cap.
        var tokens = new Mock<IEmailVerificationTokenRepository>();
        var keycloak = new Mock<IKeycloakAdminRepository>();
        var (stored, _, code) = await IssueAsync(tokens);

        stored.Attempts = 5;

        tokens.Setup(t => t.GetUserByEmailAsync(Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<User>.Success(TestUser()));
        tokens.Setup(t => t.GetLatestForUserAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<EmailVerificationToken>.Success(stored));

        // Act
        var result = await Build(tokens, keycloak).VerifyByCodeAsync(Email, code, CancellationToken.None);

        // Assert
        result.Value.Should().Be(EmailVerificationOutcome.TooManyAttempts);
        keycloak.Verify(k => k.ActivateVerifiedUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task VerifyByCodeAsync_ForAnAlreadyVerifiedUser_ReportsAlreadyVerified()
    {
        // Arrange
        var tokens = new Mock<IEmailVerificationTokenRepository>();
        tokens.Setup(t => t.GetUserByEmailAsync(Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<User>.Success(TestUser(verifiedAt: DateTime.UtcNow)));

        // Act
        var result = await Build(tokens).VerifyByCodeAsync(Email, "123456", CancellationToken.None);

        // Assert
        result.Value.Should().Be(EmailVerificationOutcome.AlreadyVerified);
    }

    [Fact]
    public async Task VerifyByCodeAsync_ForAnUnknownEmail_IsInvalid()
    {
        // Arrange
        var tokens = new Mock<IEmailVerificationTokenRepository>();
        tokens.Setup(t => t.GetUserByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<User>.NotFound());

        // Act
        var result = await Build(tokens).VerifyByCodeAsync("nobody@test.local", "123456", CancellationToken.None);

        // Assert
        result.Value.Should().Be(EmailVerificationOutcome.Invalid);
    }

    // ---- Resending ------------------------------------------------------------------

    [Fact]
    public async Task ResendAsync_ForAnUnknownEmail_ReportsSuccessAndSendsNothing()
    {
        // Arrange: the caller is unauthenticated, so it must not learn which addresses exist.
        var tokens = SucceedingTokens();
        var mail = SucceedingMail();

        tokens.Setup(t => t.GetUserByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<User>.NotFound());

        // Act
        var result = await Build(tokens, mail: mail).ResendAsync("nobody@test.local", BaseUrl, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        mail.Verify(m => m.EnqueueAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string?>>(),
            It.IsAny<CancellationToken>(), It.IsAny<string?>(), It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task ResendAsync_InsideTheCooldown_ReportsSuccessAndSendsNothing()
    {
        // Arrange
        var tokens = SucceedingTokens();
        var mail = SucceedingMail();

        tokens.Setup(t => t.GetUserByEmailAsync(Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<User>.Success(TestUser()));
        tokens.Setup(t => t.GetLatestForUserAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<EmailVerificationToken>.Success(new EmailVerificationToken
            {
                TokenHash = "hash",
                CodeHash = "hash",
                UserId = UserId,
                CreatedAt = DateTime.UtcNow.AddSeconds(-5),
                ExpiresAt = DateTime.UtcNow.AddHours(24),
            }));

        // Act
        var result = await Build(tokens, mail: mail).ResendAsync(Email, BaseUrl, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        mail.Verify(m => m.EnqueueAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string?>>(),
            It.IsAny<CancellationToken>(), It.IsAny<string?>(), It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task ResendAsync_PastTheCooldown_SendsAgain()
    {
        // Arrange
        var tokens = SucceedingTokens();
        var mail = SucceedingMail();

        tokens.Setup(t => t.GetUserByEmailAsync(Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<User>.Success(TestUser()));
        tokens.Setup(t => t.GetLatestForUserAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<EmailVerificationToken>.Success(new EmailVerificationToken
            {
                TokenHash = "hash",
                CodeHash = "hash",
                UserId = UserId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-10),
                ExpiresAt = DateTime.UtcNow.AddHours(24),
            }));

        // Act
        var result = await Build(tokens, mail: mail).ResendAsync(Email, BaseUrl, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        mail.Verify(m => m.EnqueueAsync(
            "verify-email", Email, It.IsAny<IReadOnlyDictionary<string, string?>>(),
            It.IsAny<CancellationToken>(), It.IsAny<string?>(), It.IsAny<string?>()), Times.Once);
    }

    [Fact]
    public async Task ResendAsync_ForAnAlreadyVerifiedUser_ReportsSuccessAndSendsNothing()
    {
        // Arrange
        var tokens = SucceedingTokens();
        var mail = SucceedingMail();

        tokens.Setup(t => t.GetUserByEmailAsync(Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<User>.Success(TestUser(verifiedAt: DateTime.UtcNow)));

        // Act
        var result = await Build(tokens, mail: mail).ResendAsync(Email, BaseUrl, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        mail.Verify(m => m.EnqueueAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string?>>(),
            It.IsAny<CancellationToken>(), It.IsAny<string?>(), It.IsAny<string?>()), Times.Never);
    }
}
