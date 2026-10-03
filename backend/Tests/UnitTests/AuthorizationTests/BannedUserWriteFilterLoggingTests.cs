// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Linq.Expressions;
using System.Security.Claims;
using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging;
using Moq;
using StigviddAPI.Authorization;

namespace UnitTests.AuthorizationTests;

public class BannedUserWriteFilterLoggingTests
{
    private const string SubjectId = "keycloak-sub-1";

    private static async Task<(ActionExecutingContext Context, RecordingLogger<BannedUserWriteFilter> Logger)> RunAsync(bool banned)
    {
        var repository = new Mock<IUserRepository>();
        repository
            .Setup(r => r.GetUserBySubjectAsync(SubjectId, It.IsAny<Expression<Func<User, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(banned));

        var httpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, SubjectId)], "Bearer")),
        };
        httpContext.Request.Method = "POST";

        var context = new ActionExecutingContext(
            new ActionContext(httpContext, new RouteData(), new ActionDescriptor { EndpointMetadata = [] }),
            [],
            new Dictionary<string, object?>(),
            new object());

        var logger = new RecordingLogger<BannedUserWriteFilter>();
        await new BannedUserWriteFilter(repository.Object, logger)
            .OnActionExecutionAsync(context, () => Task.FromResult(new ActionExecutedContext(context, [], new object())));

        return (context, logger);
    }

    [Fact]
    public async Task BannedWrite_IsRefusedAndLogged()
    {
        // Act
        var (context, logger) = await RunAsync(banned: true);

        // Assert
        context.Result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        var entry = logger.Entries.Should().ContainSingle().Subject;
        entry.Level.Should().Be(LogLevel.Information);
        entry.Values["SubjectId"].Should().Be(SubjectId);
        entry.Values["Method"].Should().Be("POST");
    }

    [Fact]
    public async Task WriteByAnUnbannedUser_LogsNothing()
    {
        // Act
        var (context, logger) = await RunAsync(banned: false);

        // Assert
        context.Result.Should().BeNull();
        logger.Entries.Should().BeEmpty();
    }
}
