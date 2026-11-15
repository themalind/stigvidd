// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Data.Common;
using AwesomeAssertions;
using Core.Repositories;
using Microsoft.EntityFrameworkCore;
using Npgsql;

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

    [Theory]
    [InlineData("23505", "IX_Facilities_SourceId", true)]
    [InlineData("23505", "IX_Facilities_Identifier", false)]
    [InlineData("23503", "IX_Facilities_SourceId", false)]
    public void On_RecognisesOnlyAUniqueViolationOfTheNamedIndex(string sqlState, string constraintName, bool expected)
    {
        // Arrange
        var postgres = new PostgresException("duplicate key", "ERROR", "ERROR", sqlState, constraintName: constraintName);
        var exception = new DbUpdateException("save failed", postgres);

        // Act
        var isOnIndex = UniqueViolation.On(exception, "IX_Facilities_SourceId");

        // Assert
        isOnIndex.Should().Be(expected);
    }
}
