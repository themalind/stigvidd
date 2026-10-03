// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using StigviddAPI.Controllers;

namespace UnitTests.ControllerTests;

public class StigViddControllerLoggingTests
{
    private sealed class ProbeController : StigViddController
    {
        public ActionResult Map(Message message) => ToActionResult(message);
    }

    private static (ProbeController Controller, RecordingLogger<StigViddController> Logger) WithLogger()
    {
        var logger = new RecordingLogger<StigViddController>();
        var controller = new ProbeController
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    RequestServices = new ServiceCollection()
                        .AddSingleton<ILogger<StigViddController>>(logger)
                        .BuildServiceProvider(),
                },
            },
        };

        return (controller, logger);
    }

    [Theory]
    [InlineData(500)]
    [InlineData(502)]
    public void ToActionResult_ForAServiceFailure_LogsTheServiceMessage(int statusCode)
    {
        // Arrange
        var (controller, logger) = WithLogger();

        // Act
        var result = controller.Map(new Message(statusCode, "Error deleting user with identifier abc"));

        // Assert
        result.Should().BeOfType<StatusCodeResult>().Which.StatusCode.Should().Be(500);
        var entry = logger.Entries.Should().ContainSingle().Subject;
        entry.Level.Should().Be(LogLevel.Error);
        entry.Values["StatusCode"].Should().Be(statusCode);
        entry.Values["ResultMessage"].Should().Be("Error deleting user with identifier abc");
        entry.Values["Controller"].Should().Be(nameof(ProbeController));
    }

    [Fact]
    public void ToActionResult_ForAClientError_LogsNothing()
    {
        // Arrange
        var (controller, logger) = WithLogger();

        // Act
        controller.Map(new Message(404, "Not found"));

        // Assert
        logger.Entries.Should().BeEmpty();
    }

    [Fact]
    public void ToActionResult_WithoutAnHttpContext_StillAnswers500()
    {
        // Arrange
        var controller = new ProbeController();

        // Act
        var result = controller.Map(new Message(500, "boom"));

        // Assert
        result.Should().BeOfType<StatusCodeResult>().Which.StatusCode.Should().Be(500);
    }
}
