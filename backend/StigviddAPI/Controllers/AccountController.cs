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
    private readonly ILogger<AccountController> _logger;

    public AccountController(
        IKeycloakAdminRepository keycloakAdminRepository,
        IUserService userService,
        ILogger<AccountController> logger)
    {
        _keycloakAdminRepository = keycloakAdminRepository;
        _userService = userService;
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

        return Created($"{result.Value.Identifier}", result.Value);
    }

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
}
