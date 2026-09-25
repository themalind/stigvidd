// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Logging;
using System.Security.Claims;

namespace StigviddAPI.Authorization;

/// <summary>
/// A ban is read-only, and this is where that is enforced: every write by a banned account is
/// refused with 403 unless the endpoint carries <see cref="AllowWhenBannedAttribute"/>.
/// </summary>
public class BannedUserWriteFilter : IAsyncActionFilter
{
    private static readonly string[] ReadMethods = ["GET", "HEAD", "OPTIONS", "TRACE"];

    private readonly IUserRepository _userRepository;
    private readonly ILogger<BannedUserWriteFilter> _logger;

    public BannedUserWriteFilter(IUserRepository userRepository, ILogger<BannedUserWriteFilter> logger)
    {
        _userRepository = userRepository;
        _logger = logger;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (await IsBannedWriteAsync(context))
        {
            context.Result = new ObjectResult("account-banned") { StatusCode = StatusCodes.Status403Forbidden };
            return;
        }

        await next();
    }

    private async Task<bool> IsBannedWriteAsync(ActionExecutingContext context)
    {
        if (ReadMethods.Contains(context.HttpContext.Request.Method))
            return false;

        if (context.ActionDescriptor.EndpointMetadata.OfType<AllowWhenBannedAttribute>().Any())
            return false;

        var subjectId = context.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (string.IsNullOrEmpty(subjectId))
            return false;

        var result = await _userRepository.GetUserBySubjectAsync(
            subjectId, u => u.Bans.Any(b => b.LiftedAt == null), context.HttpContext.RequestAborted);

        // A failed lookup lets the write through; a database blip must not stop every user writing.
        if (result.Status == RepositoryResultStatus.Error)
        {
            _logger.LogWarning("BannedUserWriteFilter: could not read the ban state for subject {subjectId}.", subjectId);
            return false;
        }

        return result.IsSuccess && result.Value;
    }
}
