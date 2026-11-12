// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Data.Common;
using AwesomeAssertions;
using Core.Repositories;
using Microsoft.EntityFrameworkCore;

namespace UnitTests.RepositoryTests;

public class UniqueViolationTests
{
    private sealed class FakeDbException(string? sqlState) : DbException("fake")
    {
        public override string? SqlState { get; } = sqlState;
    }

    [Theory]
    [InlineData("23505", true)]
    [InlineData("23503", false)]
    [InlineData(null, false)]
    public void Is_RecognisesOnlyPostgresUniqueViolations(string? sqlState, bool expected)
    {
        // Arrange
        var exception = new DbUpdateException("save failed", new FakeDbException(sqlState));

        // Act
        var isUnique = UniqueViolation.Is(exception);

        // Assert
        isUnique.Should().Be(expected);
    }
}
