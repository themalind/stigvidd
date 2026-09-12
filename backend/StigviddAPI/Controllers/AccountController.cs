// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.Account;
using WebDataContracts.ResponseModels.User;

namespace StigviddAPI.Controllers;

/// <summary>
/// Unauthenticated account lifecycle endpoints. Login itself is NOT here: the app performs
/// the Keycloak Direct Access Grant directly against Keycloak's token endpoint. This controller
/// covers the operations that require Keycloak admin privileges (provisioning, password reset).
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
[AllowAnonymous]
public class AccountController : StigViddController
{
    private readonly IKeycloakAdminRepository _keycloakAdminRepository;
    private readonly IUserService _userService;
    private readonly IEmailVerificationService _emailVerificationService;
    private readonly ILogger<AccountController> _logger;

    public AccountController(
        IKeycloakAdminRepository keycloakAdminRepository,
        IUserService userService,
        IEmailVerificationService emailVerificationService,
        ILogger<AccountController> logger)
    {
        _keycloakAdminRepository = keycloakAdminRepository;
        _userService = userService;
        _emailVerificationService = emailVerificationService;
        _logger = logger;
    }

    /// <summary>Body of a 409 when the email is already registered in Keycloak.</summary>
    public const string EmailTakenCode = "email-taken";

    /// <summary>Body of a 409 when the nickname is already taken by another StigVidd user.</summary>
    public const string NickNameTakenCode = "nickname-taken";

    /// <summary>
    /// Creates the Keycloak user and the matching StigVidd DB record. On DB failure the Keycloak
    /// user is rolled back so the two systems don't drift. A 409 body carries the code for the
    /// field that collided.
    /// </summary>
    [HttpPost]
    [Route("register")]
    public async Task<ActionResult<UserResponse?>> Register(
        [FromBody] RegisterRequest request,
        CancellationToken ctoken)
    {
        // Checked before provisioning, so a taken nickname leaves no Keycloak user to roll back.
        var nickNameCheck = await _userService.CheckForUsername(request.NickName, ctoken);

        if (!nickNameCheck.Success)
            return nickNameCheck.Message != null ? ToActionResult(nickNameCheck.Message) : StatusCode(500);

        if (nickNameCheck.Value?.Exists == true)
            return Conflict(NickNameTakenCode);

        string subjectId;
        try
        {
            subjectId = await _keycloakAdminRepository.CreateUserAsync(request.Email, request.NickName, request.Password, ctoken);
        }
        catch (KeycloakUserConflictException)
        {
            return Conflict(EmailTakenCode);
        }

        var result = await _userService.CreateUserAsync(request.Email, request.NickName, subjectId, ctoken);

        if (!result.Success)
        {
            // Roll back the Keycloak user so a failed DB insert doesn't leave an orphaned account.
            try
            {
                await _keycloakAdminRepository.DeleteUserAsync(subjectId, ctoken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to roll back Keycloak user {SubjectId} after DB create failure.", subjectId);
            }

            // The nickname was free before provisioning, so a conflict here is a lost race.
            if (result.Message?.StatusCode == StatusCodes.Status409Conflict)
                return Conflict(NickNameTakenCode);

            if (result.Message != null)
                return ToActionResult(result.Message);

            return StatusCode(500);
        }

        if (result.Value is null)
            return StatusCode(500);

        // The account exists but is disabled until this mail is acted on, so a failure to send
        // it leaves a user who can never log in and whose email and nickname are both taken.
        // Roll the whole registration back and let them try again.
        var userId = await _userService.GetUserIdByIdentifierAsync(result.Value.Identifier, ctoken);

        var verification = userId.Success
            ? await _emailVerificationService.IssueAndSendAsync(
                userId.Value, request.Email, request.NickName, RequestBaseUrl(), ctoken)
            : Result.Fail(new Message(500, "Could not resolve the new user."));

        if (!verification.Success)
        {
            await RollBackRegistrationAsync(result.Value.Identifier, subjectId, ctoken);
            return StatusCode(500);
        }

        return Created($"{result.Value.Identifier}", result.Value);
    }

    /// <summary>
    /// Undoes a registration in both systems. Best effort by definition: it runs because
    /// something has already gone wrong, and there is nothing useful to tell the caller if a
    /// step of the cleanup fails too.
    /// </summary>
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

        try
        {
            await _keycloakAdminRepository.DeleteUserAsync(subjectId, ctoken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to roll back Keycloak user {SubjectId} after a failed verification send.", subjectId);
        }
    }

    /// <summary>
    /// The public origin to build verification links from, when EmailVerification:BaseUrl is
    /// not configured. Behind the proxy the forwarded headers have already been applied, so
    /// this is the address the user actually reached.
    /// </summary>
    private string RequestBaseUrl() => $"{Request.Scheme}://{Request.Host}";

    /// <summary>
    /// Triggers a Keycloak "update password" email. Always returns 204 — it never reveals whether
    /// the email belongs to a registered user.
    /// </summary>
    [HttpPost]
    [Route("forgot-password")]
    public async Task<ActionResult> ForgotPassword(
        [FromBody] ForgotPasswordRequest request,
        CancellationToken ctoken)
    {
        try
        {
            await _keycloakAdminRepository.SendPasswordResetEmailAsync(request.Email, ctoken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send password reset email.");
        }

        return NoContent();
    }

    /// <summary>Body of a 400 when the submitted code does not match.</summary>
    public const string InvalidCodeCode = "invalid-code";

    /// <summary>Body of a 410 when the verification has expired and a new one must be requested.</summary>
    public const string CodeExpiredCode = "code-expired";

    /// <summary>Body of a 429 when too many wrong codes have been tried against one verification.</summary>
    public const string TooManyAttemptsCode = "too-many-attempts";

    /// <summary>
    /// The link target from the verification mail. Returns a page rather than JSON: it is
    /// opened by the user's browser from their mail client, not by the app.
    /// </summary>
    [HttpGet]
    [Route("verify-email")]
    [Produces("text/html")]
    public async Task<ActionResult> VerifyEmailByLink([FromQuery] string? token, CancellationToken ctoken)
    {
        var result = await _emailVerificationService.VerifyByTokenAsync(token ?? string.Empty, ctoken);

        if (!result.Success)
            return HtmlPage(StatusCodes.Status500InternalServerError, VerificationPage.Error);

        return result.Value switch
        {
            EmailVerificationOutcome.Verified or EmailVerificationOutcome.AlreadyVerified =>
                HtmlPage(StatusCodes.Status200OK, VerificationPage.Verified),
            EmailVerificationOutcome.Expired =>
                HtmlPage(StatusCodes.Status410Gone, VerificationPage.Expired),
            _ =>
                HtmlPage(StatusCodes.Status400BadRequest, VerificationPage.Invalid),
        };
    }

    /// <summary>
    /// Settles the verification from the six-digit code, for a user who read the mail on a
    /// different device than the one running the app.
    /// </summary>
    [HttpPost]
    [Route("verify-email")]
    public async Task<ActionResult> VerifyEmailByCode(
        [FromBody] VerifyEmailRequest request,
        CancellationToken ctoken)
    {
        var result = await _emailVerificationService.VerifyByCodeAsync(request.Email, request.Code, ctoken);

        if (!result.Success)
            return StatusCode(500);

        return result.Value switch
        {
            EmailVerificationOutcome.Verified or EmailVerificationOutcome.AlreadyVerified => NoContent(),
            EmailVerificationOutcome.Expired => StatusCode(StatusCodes.Status410Gone, CodeExpiredCode),
            EmailVerificationOutcome.TooManyAttempts => StatusCode(StatusCodes.Status429TooManyRequests, TooManyAttemptsCode),
            _ => BadRequest(InvalidCodeCode),
        };
    }

    /// <summary>
    /// Sends a fresh verification mail. Always returns 204, and like ForgotPassword it never
    /// reveals whether the address is registered, already verified, or inside its cooldown.
    /// </summary>
    [HttpPost]
    [Route("resend-verification")]
    public async Task<ActionResult> ResendVerification(
        [FromBody] ResendVerificationRequest request,
        CancellationToken ctoken)
    {
        try
        {
            await _emailVerificationService.ResendAsync(request.Email, RequestBaseUrl(), ctoken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to resend the verification email.");
        }

        return NoContent();
    }

    private ContentResult HtmlPage(int statusCode, string html) => new()
    {
        StatusCode = statusCode,
        ContentType = "text/html; charset=utf-8",
        Content = html,
    };
}
