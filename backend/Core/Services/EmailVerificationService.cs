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

public class EmailVerificationService : IEmailVerificationService
{
    // The template seeded by the AddEmailVerification migration.
    public const string TemplateKey = "verify-email";

    private const int DefaultTokenLifetimeHours = 24;
    private const int DefaultResendCooldownSeconds = 60;
    private const int DefaultMaxCodeAttempts = 5;

    private readonly IEmailVerificationTokenRepository _tokenRepository;
    private readonly IKeycloakAdminRepository _keycloakAdminRepository;
    private readonly IMailOutboxService _mailOutboxService;
    private readonly ILogger<EmailVerificationService> _logger;

    private readonly int _tokenLifetimeHours;
    private readonly int _resendCooldownSeconds;
    private readonly int _maxCodeAttempts;
    private readonly string? _configuredBaseUrl;

    public EmailVerificationService(
        IEmailVerificationTokenRepository tokenRepository,
        IKeycloakAdminRepository keycloakAdminRepository,
        IMailOutboxService mailOutboxService,
        IConfiguration configuration,
        ILogger<EmailVerificationService> logger)
    {
        _tokenRepository = tokenRepository;
        _keycloakAdminRepository = keycloakAdminRepository;
        _mailOutboxService = mailOutboxService;
        _logger = logger;

        _tokenLifetimeHours = ReadInt(configuration, "EmailVerification:TokenLifetimeHours", DefaultTokenLifetimeHours);
        _resendCooldownSeconds = ReadInt(configuration, "EmailVerification:ResendCooldownSeconds", DefaultResendCooldownSeconds);
        _maxCodeAttempts = ReadInt(configuration, "EmailVerification:MaxCodeAttempts", DefaultMaxCodeAttempts);

        // Absent in appsettings on purpose, the way Smtp:* is: docker-compose supplies it per
        // environment. The request's own base URL stands in when it is missing, which is what
        // makes local development and the test host work unconfigured.
        _configuredBaseUrl = configuration["EmailVerification:BaseUrl"];
    }

    private static int ReadInt(IConfiguration configuration, string key, int fallback)
    {
        var raw = configuration[key];
        return int.TryParse(raw, out var value) && value > 0 ? value : fallback;
    }

    public async Task<Result> IssueAndSendAsync(
        int userId, string email, string nickName, string requestBaseUrl, CancellationToken ctoken)
    {
        var rawToken = GenerateToken();
        var code = GenerateCode();
        var now = DateTime.UtcNow;

        var token = new EmailVerificationToken
        {
            UserId = userId,
            TokenHash = Hash(rawToken),
            CodeHash = Hash(code),
            ExpiresAt = now.AddHours(_tokenLifetimeHours),
            CreatedAt = now,
            LastUpdatedAt = now,
        };

        var stored = await _tokenRepository.ReplaceOutstandingAsync(token, ctoken);

        if (!stored.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while issuing the verification."));

        var baseUrl = (string.IsNullOrWhiteSpace(_configuredBaseUrl) ? requestBaseUrl : _configuredBaseUrl).TrimEnd('/');
        var verificationUrl = $"{baseUrl}/api/v1/account/verify-email?token={Uri.EscapeDataString(rawToken)}";

        var enqueued = await _mailOutboxService.EnqueueAsync(
            TemplateKey,
            email,
            new Dictionary<string, string?>
            {
                ["NickName"] = nickName,
                ["VerificationUrl"] = verificationUrl,
                ["VerificationCode"] = code,
            },
            ctoken,
            toName: nickName);

        if (!enqueued.Success)
        {
            // An unknown template or a placeholder the model has no value for is a bug here,
            // not a transport problem -- and enqueue time is the last moment anyone is
            // listening. Surface it rather than leaving a user who can never be verified.
            _logger.LogError(
                "EmailVerificationService: IssueAndSendAsync -> Could not queue the verification mail for user {userId}: {status} {message}",
                userId,
                enqueued.Message?.StatusCode,
                enqueued.Message?.ResultMessage);

            return Result.Fail(new Message(500, "An error occurred while sending the verification email."));
        }

        return Result.Ok();
    }

    public async Task<Result<EmailVerificationOutcome>> VerifyByTokenAsync(string rawToken, CancellationToken ctoken)
    {
        if (string.IsNullOrWhiteSpace(rawToken))
            return Result.Ok(EmailVerificationOutcome.Invalid);

        var lookup = await _tokenRepository.GetByTokenHashAsync(Hash(rawToken), ctoken);

        if (lookup.Status == RepositoryResultStatus.Error)
            return Result.Fail<EmailVerificationOutcome>(new Message(500, "An error occurred while verifying the email address."));

        if (!lookup.IsSuccess)
            return Result.Ok(EmailVerificationOutcome.Invalid);

        return await SettleAsync(lookup.Value, ctoken);
    }

    public async Task<Result<EmailVerificationOutcome>> VerifyByCodeAsync(string email, string code, CancellationToken ctoken)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(code))
            return Result.Ok(EmailVerificationOutcome.Invalid);

        var userLookup = await _tokenRepository.GetUserByEmailAsync(email, ctoken);

        if (userLookup.Status == RepositoryResultStatus.Error)
            return Result.Fail<EmailVerificationOutcome>(new Message(500, "An error occurred while verifying the email address."));

        if (!userLookup.IsSuccess)
            return Result.Ok(EmailVerificationOutcome.Invalid);

        var user = userLookup.Value;

        if (user.EmailVerifiedAt is not null)
            return Result.Ok(EmailVerificationOutcome.AlreadyVerified);

        var lookup = await _tokenRepository.GetLatestForUserAsync(user.Id, ctoken);

        if (lookup.Status == RepositoryResultStatus.Error)
            return Result.Fail<EmailVerificationOutcome>(new Message(500, "An error occurred while verifying the email address."));

        if (!lookup.IsSuccess)
            return Result.Ok(EmailVerificationOutcome.Invalid);

        var token = lookup.Value;

        if (token.Attempts >= _maxCodeAttempts)
            return Result.Ok(EmailVerificationOutcome.TooManyAttempts);

        // Fixed-time comparison: the code is short enough that a timing oracle would meaningfully
        // narrow a brute force, and the comparison costs nothing either way.
        if (!FixedTimeEquals(token.CodeHash, Hash(code.Trim())))
        {
            var counted = await _tokenRepository.IncrementAttemptsAsync(token.Id, ctoken);

            if (counted.IsSuccess && counted.Value >= _maxCodeAttempts)
                return Result.Ok(EmailVerificationOutcome.TooManyAttempts);

            return Result.Ok(EmailVerificationOutcome.Invalid);
        }

        return await SettleAsync(token, ctoken);
    }

    public async Task<Result> ResendAsync(string email, string requestBaseUrl, CancellationToken ctoken)
    {
        var userLookup = await _tokenRepository.GetUserByEmailAsync(email, ctoken);

        if (userLookup.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while resending the verification email."));

        if (!userLookup.IsSuccess)
        {
            // Don't reveal whether the email is registered -- same stance as ForgotPassword.
            _logger.LogInformation("Verification resend requested for an unknown email; ignoring.");
            return Result.Ok();
        }

        var user = userLookup.Value;

        if (user.EmailVerifiedAt is not null)
        {
            _logger.LogInformation("Verification resend requested for an already verified user; ignoring.");
            return Result.Ok();
        }

        var latest = await _tokenRepository.GetLatestForUserAsync(user.Id, ctoken);

        if (latest.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while resending the verification email."));

        if (latest.IsSuccess && latest.Value.CreatedAt.AddSeconds(_resendCooldownSeconds) > DateTime.UtcNow)
        {
            // Inside the cooldown. Reported as success: the caller is unauthenticated, so the
            // distinction would tell them the address exists.
            _logger.LogInformation("Verification resend for user {userId} is inside its cooldown; ignoring.", user.Id);
            return Result.Ok();
        }

        return await IssueAndSendAsync(user.Id, user.Email, user.NickName, requestBaseUrl, ctoken);
    }

    /// <summary>
    /// The shared tail of both verification paths: expiry, then consume, then enable in Keycloak.
    /// </summary>
    private async Task<Result<EmailVerificationOutcome>> SettleAsync(EmailVerificationToken token, CancellationToken ctoken)
    {
        // A consumed token whose user is verified is the prefetch case: a scanner followed the
        // link, and the human is clicking it now. Answer the human, not the scanner.
        if (token.ConsumedAt is not null)
        {
            return token.User?.EmailVerifiedAt is not null
                ? Result.Ok(EmailVerificationOutcome.AlreadyVerified)
                : Result.Ok(EmailVerificationOutcome.Invalid);
        }

        if (token.User?.EmailVerifiedAt is not null)
            return Result.Ok(EmailVerificationOutcome.AlreadyVerified);

        if (token.ExpiresAt <= DateTime.UtcNow)
            return Result.Ok(EmailVerificationOutcome.Expired);

        if (token.User is null)
        {
            _logger.LogError("EmailVerificationService: token {tokenId} has no user loaded.", token.Id);
            return Result.Fail<EmailVerificationOutcome>(new Message(500, "An error occurred while verifying the email address."));
        }

        var consumed = await _tokenRepository.ConsumeAsync(token.Id, DateTime.UtcNow, ctoken);

        if (!consumed.IsSuccess)
            return Result.Fail<EmailVerificationOutcome>(new Message(500, "An error occurred while verifying the email address."));

        try
        {
            // Last, and deliberately so: this is the step that actually lets the user log in.
            // Consuming first means a failure here leaves them verified in our database but
            // still disabled -- visible, and fixable by an operator, which is the better half
            // of the two to be stuck on.
            await _keycloakAdminRepository.ActivateVerifiedUserAsync(token.User.SubjectId, ctoken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EmailVerificationService: failed to enable Keycloak user {subjectId} after verification.", token.User.SubjectId);
            return Result.Fail<EmailVerificationOutcome>(new Message(500, "An error occurred while verifying the email address."));
        }

        return Result.Ok(EmailVerificationOutcome.Verified);
    }

    /// <summary>32 random bytes, base64url. Long enough that the link is the secret.</summary>
    private static string GenerateToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');

    /// <summary>Six digits, zero padded. Short enough to retype, hence the attempt cap.</summary>
    private static string GenerateCode() =>
        RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

    private static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static bool FixedTimeEquals(string a, string b) =>
        CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(a),
            Encoding.UTF8.GetBytes(b));
}
