// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using System.Net;
using System.Security.Claims;
using WebDataContracts.ResponseModels.User;

namespace StigviddAPI.Controllers;

public abstract class StigViddController : Controller
{
    protected ActionResult ToActionResult(Message message)
    {
        return message.StatusCode switch
        {
            (int)HttpStatusCode.NotFound => NotFound(message.ResultMessage),
            (int)HttpStatusCode.BadRequest => BadRequest(message.ResultMessage),
            (int)HttpStatusCode.Conflict => Conflict(message.ResultMessage),
            (int)HttpStatusCode.Unauthorized => Unauthorized(message.ResultMessage),
            (int)HttpStatusCode.Forbidden => StatusCode(StatusCodes.Status403Forbidden, message.ResultMessage),
            (int)HttpStatusCode.TooManyRequests => StatusCode(StatusCodes.Status429TooManyRequests, message.ResultMessage),
            _ => ServerError(message)
        };

    }

    private StatusCodeResult ServerError(Message message)
    {
        Logger.LogError(
            "{Controller}: a {StatusCode} from the service layer was returned as 500: {ResultMessage}",
            GetType().Name,
            message.StatusCode,
            message.ResultMessage);

        return StatusCode(StatusCodes.Status500InternalServerError);
    }

    protected async Task<UserResponse?> GetAuthenticatedUserAsync(
        IUserService userService,
        CancellationToken ctoken)
    {
        var subjectId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (string.IsNullOrEmpty(subjectId))
        {
            Logger.LogInformation("{Controller}: the token carries no subject id.", GetType().Name);
            return null;
        }

        var userResult = await userService.GetUserBySubjectAsync(subjectId, ctoken);

        if (userResult?.Value is null)
        {
            Logger.LogInformation(
                "{Controller}: no user found for subject {SubjectId}.",
                GetType().Name,
                subjectId);
        }

        return userResult?.Value;
    }

    private ILogger Logger =>
        HttpContext?.RequestServices?.GetService<ILogger<StigViddController>>() ?? NullLogger<StigViddController>.Instance;
}
