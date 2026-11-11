// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.Extensions.Logging;

namespace Core.Services.Account;

public class AccountRegistrationService : IAccountRegistrationService
{
    private readonly IKeycloakAdminRepository _keycloakAdminRepository;
    private readonly IUserService _userService;
    private readonly IEmailVerificationService _emailVerificationService;
    private readonly ILogger<AccountRegistrationService> _logger;

    public AccountRegistrationService(
        IKeycloakAdminRepository keycloakAdminRepository,
        IUserService userService,
        IEmailVerificationService emailVerificationService,
        ILogger<AccountRegistrationService> logger)
    {
        _keycloakAdminRepository = keycloakAdminRepository;
        _userService = userService;
        _emailVerificationService = emailVerificationService;
        _logger = logger;
    }

    public async Task<AccountRegistrationResult> RegisterAsync(
        string email,
        string nickName,
        string password,
        string requestBaseUrl,
        CancellationToken ctoken)
    {
        // Checked before provisioning. keep-comment: a taken nickname then leaves no Keycloak user to roll back
        var nickNameCheck = await _userService.CheckForUsername(nickName, ctoken);

        if (!nickNameCheck.Success)
        {
            return Failed(nickNameCheck.Message);
        }

        if (nickNameCheck.Value?.Exists == true)
        {
            return new AccountRegistrationResult(AccountRegistrationOutcome.NickNameTaken);
        }

        string subjectId;
        try
        {
            subjectId = await _keycloakAdminRepository.CreateUserAsync(email, nickName, password, ctoken);
        }
        catch (KeycloakUserConflictException)
        {
            _logger.LogInformation("AccountRegistrationService: RegisterAsync -> refused, the email address is already registered.");
            return new AccountRegistrationResult(AccountRegistrationOutcome.EmailTaken);
        }

        var created = await _userService.CreateUserAsync(email, nickName, subjectId, ctoken);

        if (!created.Success)
        {
            await RollBackKeycloakUserAsync(subjectId, "DB create failure", ctoken);

            // keep-comment: the nickname was free before provisioning, so a conflict here is a lost race
            if (created.Message?.StatusCode == 409)
            {
                return new AccountRegistrationResult(AccountRegistrationOutcome.NickNameTaken);
            }

            return Failed(created.Message);
        }

        if (created.Value is null)
        {
            return Failed(null);
        }

        var userId = await _userService.GetUserIdByIdentifierAsync(created.Value.Identifier, ctoken);

        var verification = userId.Success
            ? await _emailVerificationService.IssueAndSendAsync(userId.Value, email, nickName, requestBaseUrl, ctoken)
            : Result.Fail(new Message(500, "Could not resolve the new user."));

        if (!verification.Success)
        {
            // keep-comment: the account stays disabled until this mail is acted on, so keeping it would lock its email and nickname
            await RollBackRegistrationAsync(created.Value.Identifier, subjectId, ctoken);
            return Failed(null);
        }

        _logger.LogInformation("AccountRegistrationService: RegisterAsync -> created account {SubjectId}.", subjectId);

        return new AccountRegistrationResult(AccountRegistrationOutcome.Created, created.Value);
    }

    private static AccountRegistrationResult Failed(Message? failure)
    {
        return new AccountRegistrationResult(AccountRegistrationOutcome.Failed, Failure: failure);
    }

    private async Task RollBackRegistrationAsync(string userIdentifier, string subjectId, CancellationToken ctoken)
    {
        try
        {
            await _userService.DeleteUserAsync(userIdentifier, ctoken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to roll back StigVidd user {UserIdentifier} after a failed verification send.", userIdentifier);
        }

        await RollBackKeycloakUserAsync(subjectId, "a failed verification send", ctoken);
    }

    private async Task RollBackKeycloakUserAsync(string subjectId, string reason, CancellationToken ctoken)
    {
        try
        {
            await _keycloakAdminRepository.DeleteUserAsync(subjectId, ctoken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to roll back Keycloak user {SubjectId} after {Reason}.", subjectId, reason);
        }
    }
}
