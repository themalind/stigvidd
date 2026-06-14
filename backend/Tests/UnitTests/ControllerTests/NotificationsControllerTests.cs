using Core.Interfaces.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Moq;
using StigviddAPI.Controllers;
using System.Security.Claims;
using WebDataContracts.RequestModels.PushToken;
using WebDataContracts.ResponseModels.User;

namespace UnitTests.ControllerTests;

public class NotificationsControllerTests
{
    private static NotificationsController BuildController(
        Mock<IPushNotificationService>? pushServiceMock = null,
        Mock<IUserService>? userServiceMock = null,
        string? firebaseUid = "firebase-uid")
    {
        var controller = new NotificationsController(
            pushServiceMock?.Object ?? new Mock<IPushNotificationService>().Object,
            userServiceMock?.Object ?? BuildAuthenticatedUserService().Object
        );

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = firebaseUid is null
                    ? new ClaimsPrincipal()
                    : new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, firebaseUid)]))
            }
        };

        return controller;
    }

    private static Mock<IUserService> BuildAuthenticatedUserService(UserResponse? user = null)
    {
        var mock = new Mock<IUserService>();
        var response = user ?? UserResponse.Create(Utilities.Identifiers.User, "NaturElskaren", "natur@example.local");
        mock.Setup(u => u.GetUserByFirebaseUidAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok<UserResponse?>(response));
        return mock;
    }

    private static RegisterPushTokenRequest ValidRegisterRequest() => new()
    {
        ExpoToken = "ExponentPushToken[xxxxxx]",
        Platform = "ios"
    };

    // RegisterTokenAsync

    [Fact]
    public async Task RegisterTokenAsync_WhenNoAuthClaim_ReturnsUnauthorized()
    {
        var controller = BuildController(firebaseUid: null);

        var result = await controller.RegisterTokenAsync(ValidRegisterRequest(), CancellationToken.None);

        result.Should().BeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task RegisterTokenAsync_WhenUserNotFoundInService_ReturnsUnauthorized()
    {
        var userServiceMock = new Mock<IUserService>();
        userServiceMock.Setup(u => u.GetUserByFirebaseUidAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok<UserResponse?>(null));

        var controller = BuildController(userServiceMock: userServiceMock);

        var result = await controller.RegisterTokenAsync(ValidRegisterRequest(), CancellationToken.None);

        result.Should().BeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task RegisterTokenAsync_WhenPushServiceReturnsNotFound_Returns404()
    {
        var pushServiceMock = new Mock<IPushNotificationService>();
        pushServiceMock.Setup(p => p.RegisterTokenAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail(new Message(404, "User not found")));

        var controller = BuildController(pushServiceMock: pushServiceMock);

        var result = await controller.RegisterTokenAsync(ValidRegisterRequest(), CancellationToken.None);

        result.Should().BeAssignableTo<IStatusCodeActionResult>()
            .Which.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task RegisterTokenAsync_WhenPushServiceErrors_Returns500()
    {
        var pushServiceMock = new Mock<IPushNotificationService>();
        pushServiceMock.Setup(p => p.RegisterTokenAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail(new Message(500, "Internal error")));

        var controller = BuildController(pushServiceMock: pushServiceMock);

        var result = await controller.RegisterTokenAsync(ValidRegisterRequest(), CancellationToken.None);

        result.Should().BeAssignableTo<IStatusCodeActionResult>()
            .Which.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task RegisterTokenAsync_WhenSuccessful_ReturnsOk()
    {
        var pushServiceMock = new Mock<IPushNotificationService>();
        pushServiceMock.Setup(p => p.RegisterTokenAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        var controller = BuildController(pushServiceMock: pushServiceMock);

        var result = await controller.RegisterTokenAsync(ValidRegisterRequest(), CancellationToken.None);

        result.Should().BeOfType<OkResult>();
    }

    // DeleteTokenAsync

    [Fact]
    public async Task DeleteTokenAsync_WhenNoAuthClaim_ReturnsUnauthorized()
    {
        var controller = BuildController(firebaseUid: null);

        var result = await controller.DeleteTokenAsync("ExponentPushToken[xxx]", CancellationToken.None);

        result.Should().BeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task DeleteTokenAsync_WhenUserNotFoundInService_ReturnsUnauthorized()
    {
        var userServiceMock = new Mock<IUserService>();
        userServiceMock.Setup(u => u.GetUserByFirebaseUidAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok<UserResponse?>(null));

        var controller = BuildController(userServiceMock: userServiceMock);

        var result = await controller.DeleteTokenAsync("ExponentPushToken[xxx]", CancellationToken.None);

        result.Should().BeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task DeleteTokenAsync_WhenPushServiceReturnsNotFound_Returns404()
    {
        var pushServiceMock = new Mock<IPushNotificationService>();
        pushServiceMock.Setup(p => p.UnregisterTokenAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail(new Message(404, "Token not found")));

        var controller = BuildController(pushServiceMock: pushServiceMock);

        var result = await controller.DeleteTokenAsync("ExponentPushToken[xxx]", CancellationToken.None);

        result.Should().BeAssignableTo<IStatusCodeActionResult>()
            .Which.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteTokenAsync_WhenPushServiceErrors_Returns500()
    {
        var pushServiceMock = new Mock<IPushNotificationService>();
        pushServiceMock.Setup(p => p.UnregisterTokenAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail(new Message(500, "Internal error")));

        var controller = BuildController(pushServiceMock: pushServiceMock);

        var result = await controller.DeleteTokenAsync("ExponentPushToken[xxx]", CancellationToken.None);

        result.Should().BeAssignableTo<IStatusCodeActionResult>()
            .Which.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task DeleteTokenAsync_WhenSuccessful_ReturnsOk()
    {
        var pushServiceMock = new Mock<IPushNotificationService>();
        pushServiceMock.Setup(p => p.UnregisterTokenAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        var controller = BuildController(pushServiceMock: pushServiceMock);

        var result = await controller.DeleteTokenAsync("ExponentPushToken[xxx]", CancellationToken.None);

        result.Should().BeOfType<OkResult>();
    }
}
