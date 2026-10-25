// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core;
using Core.Interfaces.Repositories;
using Core.Repositories;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests.RepositoryTests;

public class AccountDeletionRepositoryTests : TestBase
{
    [Fact]
    public async Task DeleteAccount_WhenNotFound_ReturnsNotFoundAndLeavesKeycloakAlone()
    {
        // Arrange
        var keycloak = new Mock<IKeycloakAdminRepository>();
        var repo = new AccountDeletionRepository(CreateSeededFactory(), keycloak.Object, NullLogger<AccountDeletionRepository>.Instance);

        // Act
        var result = await repo.DeleteAccountAsync("no-such-user", TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
        keycloak.Verify(k => k.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
