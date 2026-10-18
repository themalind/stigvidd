// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Core.Services;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using WebDataContracts.RequestModels.UserMapping;

namespace UnitTests.ServiceTests;

public class UserKeycloakMappingServiceTests
{
    private readonly Mock<IUserKeycloakMappingRepository> _repository = new();
    private readonly Mock<IKeycloakAdminRepository> _keycloak = new();

    private UserKeycloakMappingService Service(bool sharedServices = true) =>
        new(
            _repository.Object,
            _keycloak.Object,
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { ["DataTransfer:SharedServices"] = sharedServices.ToString() })
                .Build(),
            NullLogger<UserKeycloakMappingService>.Instance);

    private static SaveUserMappingRequest Request() => new()
    {
        KeycloakSubjectId = "staging-sub",
        NickName = "StagingPerson",
        Email = "staging.person@example.local",
    };

    [Fact]
    public async Task Save_WhenKeycloakHasNoSuchUser_ReturnsNotFoundAndSavesNothing()
    {
        // Arrange
        _keycloak.Setup(k => k.FindUserAsync("staging-sub", It.IsAny<CancellationToken>()))
            .ReturnsAsync((KeycloakUserSummary?)null);

        // Act
        var result = await Service().SaveAsync(7, Request(), TestContext.Current.CancellationToken);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        _repository.Verify(r => r.SaveAsync(It.IsAny<UserKeycloakMapping>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Save_WhenTheSubjectBelongsToAnotherMapping_ReturnsConflict()
    {
        // Arrange
        _keycloak.Setup(k => k.FindUserAsync("staging-sub", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new KeycloakUserSummary("staging-sub", "staging.person@example.local", null, true));
        _repository.Setup(r => r.SaveAsync(It.IsAny<UserKeycloakMapping>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Conflict());

        // Act
        var result = await Service().SaveAsync(7, Request(), TestContext.Current.CancellationToken);

        // Assert
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task Save_StoresTheKeycloakIdentifiersNotTheRequestedOnes()
    {
        // Arrange
        _keycloak.Setup(k => k.FindUserAsync("staging-sub", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new KeycloakUserSummary("staging-sub", "staging.person@example.local", null, true));
        UserKeycloakMapping? saved = null;
        _repository.Setup(r => r.SaveAsync(It.IsAny<UserKeycloakMapping>(), It.IsAny<CancellationToken>()))
            .Callback<UserKeycloakMapping, CancellationToken>((m, _) => saved = m)
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Service().SaveAsync(7, Request(), TestContext.Current.CancellationToken);

        // Assert
        result.IsFailure.Should().BeFalse();
        saved.Should().NotBeNull();
        saved.PackageUserId.Should().Be(7);
        saved.KeycloakUsername.Should().Be("staging.person@example.local");
        saved.NickName.Should().Be("StagingPerson");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("ab")]
    public async Task Search_WithATermShorterThanThreeCharacters_IsRefusedWithoutAskingKeycloak(string? term)
    {
        // Act
        var result = await Service().SearchKeycloakUsersAsync(term, TestContext.Current.CancellationToken);

        // Assert
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
        _keycloak.Verify(k => k.SearchUsersAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task EveryOperation_OnAHostThatDoesNotShareServices_IsNotFoundAndTouchesNothing()
    {
        // Arrange
        var service = Service(sharedServices: false);
        var ctoken = TestContext.Current.CancellationToken;

        // Act
        var results = new[]
        {
            (await service.GetAsync(ctoken)).Message,
            (await service.SearchKeycloakUsersAsync("anna", ctoken)).Message,
            (await service.SaveAsync(7, Request(), ctoken)).Message,
            (await service.DeleteAsync(7, ctoken)).Message,
        };

        // Assert
        results.Should().OnlyContain(m => m != null && m.StatusCode == 404);
        _repository.VerifyNoOtherCalls();
        _keycloak.VerifyNoOtherCalls();
    }
}
