// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;
using System.Text;

namespace Core.Services;

public class PasswordResetService : IPasswordResetService
{
    // The template seeded by the AddPasswordReset migration.
    public const string TemplateKey = "reset-password";

    // Two hours, against email verification's 24. This link changes a credential, so the window
    // in which a forwarded or intercepted mail is still usable should be short -- but not
    // shorter than the mail itself can take to arrive: the outbox backs off 1, 2, 4, 8, 16
    // minutes and the mail server greylists, so ~31 minutes can pass before delivery is even
    // attempted successfully. An hour would let a link expire in transit.
    private const int DefaultTokenLifetimeHours = 2;
    private const int DefaultResendCooldownSeconds = 60;

    private readonly IPasswordResetTokenRepository _tokenRepository;
    private readonly IKeycloakAdminRepository _keycloakAdminRepository;
    private readonly IMailOutboxService _mailOutboxService;
    private readonly ILogger<PasswordResetService> _logger;

    private readonly int _tokenLifetimeHours;
    private readonly int _resendCooldownSeconds;
    private readonly string? _configuredBaseUrl;

    public PasswordResetService(
        IPasswordResetTokenRepository tokenRepository,
        IKeycloakAdminRepository keycloakAdminRepository,
        IMailOutboxService mailOutboxService,
        IConfiguration configuration,
        ILogger<PasswordResetService> logger)
    {
        _tokenRepository = tokenRepository;
        _keycloakAdminRepository = keycloakAdminRepository;
        _mailOutboxService = mailOutboxService;
        _logger = logger;

        _tokenLifetimeHours = ReadInt(configuration, "PasswordReset:TokenLifetimeHours", DefaultTokenLifetimeHours);
        _resendCooldownSeconds = ReadInt(configuration, "PasswordReset:ResendCooldownSeconds", DefaultResendCooldownSeconds);

        // Absent in appsettings on purpose, the way Smtp:* and EmailVerification:BaseUrl are:
        // docker-compose supplies it per environment. The request's own base URL stands in
        // when it is missing, which is what makes local development and the test host work
        // unconfigured.
        _configuredBaseUrl = configuration["PasswordReset:BaseUrl"];
    }

    private static int ReadInt(IConfiguration configuration, string key, int fallback)
    {
        var raw = configuration[key];
        return int.TryParse(raw, out var value) && value > 0 ? value : fallback;
    }

    public async Task<Result> IssueAndSendAsync(string email, string requestBaseUrl, CancellationToken ctoken)
    {
        var userLookup = await _tokenRepository.GetUserByEmailAsync(email, ctoken);

        if (userLookup.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while sending the password reset email."));

        if (!userLookup.IsSuccess)
        {
            // Don't reveal whether the email is registered -- the caller is unauthenticated,
            // so any difference here is a user-enumeration oracle.
            _logger.LogInformation("Password reset requested for an unknown email; ignoring.");
            return Result.Ok();
        }

        var user = userLookup.Value;

        // An unverified user is deliberately NOT refused: refusing would tell an anonymous
        // caller which addresses have been verified. Their Keycloak account stays disabled,
        // so they still cannot log in until they verify -- a reset must not be a second way
        // past the verification gate. See docs/notes/verification-gate-lives-in-keycloak-not-the-api.md.
        var latest = await _tokenRepository.GetLatestForUserAsync(user.Id, ctoken);

        if (latest.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while sending the password reset email."));

        if (latest.IsSuccess && latest.Value.CreatedAt.AddSeconds(_resendCooldownSeconds) > DateTime.UtcNow)
        {
            // Inside the cooldown. Reported as success, for the same enumeration reason.
            _logger.LogInformation("Password reset for user {userId} is inside its cooldown; ignoring.", user.Id);
            return Result.Ok();
        }

        var rawToken = GenerateToken();
        var now = DateTime.UtcNow;

        var token = new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = Hash(rawToken),
            ExpiresAt = now.AddHours(_tokenLifetimeHours),
            CreatedAt = now,
            LastUpdatedAt = now,
        };

        var stored = await _tokenRepository.ReplaceOutstandingAsync(token, ctoken);

        if (!stored.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while sending the password reset email."));

        var baseUrl = (string.IsNullOrWhiteSpace(_configuredBaseUrl) ? requestBaseUrl : _configuredBaseUrl).TrimEnd('/');
        var resetUrl = $"{baseUrl}/api/v1/account/reset-password?token={Uri.EscapeDataString(rawToken)}";

        var enqueued = await _mailOutboxService.EnqueueAsync(
            TemplateKey,
            user.Email,
            new Dictionary<string, string?>
            {
                ["NickName"] = user.NickName,
                ["ResetUrl"] = resetUrl,
            },
            ctoken,
            toName: user.NickName);

        if (!enqueued.Success)
        {
            // An unknown template or a placeholder the model has no value for is a bug here,
            // not a transport problem -- and enqueue time is the last moment anyone is
            // listening. Surface it rather than leaving a user who can never reset.
            _logger.LogError(
                "PasswordResetService: IssueAndSendAsync -> Could not queue the reset mail for user {userId}: {status} {message}",
                user.Id,
                enqueued.Message?.StatusCode,
                enqueued.Message?.ResultMessage);

            return Result.Fail(new Message(500, "An error occurred while sending the password reset email."));
        }

        return Result.Ok();
    }

    public async Task<Result<PasswordResetOutcome>> ValidateAsync(string rawToken, CancellationToken ctoken)
    {
        var lookup = await LookUpAsync(rawToken, ctoken);

        if (lookup.IsFailure)
            return Result.Fail<PasswordResetOutcome>(lookup.Message!);

        // Nothing is written here. A mail scanner prefetching the link gets the form, and the
        // human who clicks it afterwards gets the same form against the same live token.
        return Result.Ok(lookup.Value.Outcome);
    }

    public async Task<Result<PasswordResetOutcome>> ResetAsync(string rawToken, string newPassword, CancellationToken ctoken)
    {
        var lookup = await LookUpAsync(rawToken, ctoken);

        if (lookup.IsFailure)
            return Result.Fail<PasswordResetOutcome>(lookup.Message!);

        if (lookup.Value.Token is null)
            return Result.Ok(lookup.Value.Outcome);

        var token = lookup.Value.Token;

        if (token.User is null)
        {
            _logger.LogError("PasswordResetService: token {tokenId} has no user loaded.", token.Id);
            return Result.Fail<PasswordResetOutcome>(new Message(500, "An error occurred while resetting the password."));
        }

        bool accepted;

        try
        {
            accepted = await _keycloakAdminRepository.SetPasswordAsync(token.User.SubjectId, newPassword, ctoken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "PasswordResetService: failed to set the Keycloak password for {subjectId}.", token.User.SubjectId);
            return Result.Fail<PasswordResetOutcome>(new Message(500, "An error occurred while resetting the password."));
        }

        // The realm policy refused it. The link is left alive on purpose: the user is in front
        // of the form and needs to be able to try a stronger password without a new mail.
        if (!accepted)
            return Result.Ok(PasswordResetOutcome.WeakPassword);

        var consumed = await _tokenRepository.ConsumeAsync(token.Id, DateTime.UtcNow, ctoken);

        if (!consumed.IsSuccess)
        {
            // The password IS changed at this point. Failing the request would tell the user
            // it did not work and invite them to try the link again, which is worse than
            // leaving a spent-but-unmarked row for the expiry to collect.
            _logger.LogError(
                "PasswordResetService: password for user {userId} was changed but token {tokenId} could not be consumed.",
                token.UserId,
                token.Id);
        }

        return Result.Ok(PasswordResetOutcome.Reset);
    }

    /// <summary>
    /// What a token lookup found. <c>Token</c> is non-null only when <c>Outcome</c> is
    /// <see cref="PasswordResetOutcome.Valid"/>; otherwise it says which kind of no.
    /// </summary>
    private readonly record struct PasswordResetLookup(PasswordResetToken? Token, PasswordResetOutcome Outcome);

    /// <summary>Finds a live token for a raw value, writing nothing.</summary>
    private async Task<Result<PasswordResetLookup>> LookUpAsync(string rawToken, CancellationToken ctoken)
    {
        if (string.IsNullOrWhiteSpace(rawToken))
            return Result.Ok(new PasswordResetLookup(null, PasswordResetOutcome.Invalid));

        var lookup = await _tokenRepository.GetByTokenHashAsync(Hash(rawToken), ctoken);

        if (lookup.Status == RepositoryResultStatus.Error)
            return Result.Fail<PasswordResetLookup>(new Message(500, "An error occurred while resetting the password."));

        if (!lookup.IsSuccess)
            return Result.Ok(new PasswordResetLookup(null, PasswordResetOutcome.Invalid));

        var token = lookup.Value;

        // A consumed or expired row is reported as Expired rather than Invalid, so the page can
        // say "ask for a new mail" instead of "this link is wrong".
        if (token.ConsumedAt is not null || token.ExpiresAt <= DateTime.UtcNow)
            return Result.Ok(new PasswordResetLookup(null, PasswordResetOutcome.Expired));

        return Result.Ok(new PasswordResetLookup(token, PasswordResetOutcome.Valid));
    }

    /// <summary>32 random bytes, base64url. Long enough that the link is the secret, which is
    /// why there is no attempt cap here the way there is on the six-digit verification code.</summary>
    private static string GenerateToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');

    private static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}
