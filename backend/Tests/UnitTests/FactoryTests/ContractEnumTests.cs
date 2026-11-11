// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Text.Json;
using AwesomeAssertions;
using Database = Infrastructure.Enums;
using Contract = WebDataContracts.Enums;

namespace UnitTests.FactoryTests;

public class ContractEnumTests
{
    public static TheoryData<Type, Type> Twins => new()
    {
        { typeof(Database.MatchConfidence), typeof(Contract.MatchConfidence) },
        { typeof(Database.ProposalDecision), typeof(Contract.ProposalDecision) },
        { typeof(Database.TrailSourceLinkRole), typeof(Contract.TrailSourceLinkRole) },
        { typeof(Database.ImportSessionStatus), typeof(Contract.ImportSessionStatus) },
        { typeof(Database.HikeSubmissionStatus), typeof(Contract.HikeSubmissionStatus) },
        { typeof(Database.ReportStatus), typeof(Contract.ReportStatus) },
        { typeof(Database.OutboxEmailStatus), typeof(Contract.OutboxEmailStatus) },
        { typeof(Database.MediaReprocessItemStatus), typeof(Contract.MediaReprocessItemStatus) },
    };

    // keep-comment: a member added to a database enum alone would make ToContract throw on the first row that carries it
    [Theory]
    [MemberData(nameof(Twins))]
    public void EveryDatabaseMemberHasAContractTwinOfTheSameName(Type database, Type contract)
    {
        // Act
        var databaseNames = Enum.GetNames(database);
        var contractNames = Enum.GetNames(contract);

        // Assert
        contractNames.Should().BeEquivalentTo(databaseNames);
    }

    [Fact]
    public void MapsByNameRatherThanByNumber()
    {
        // Act
        var mapped = Database.ProposalDecision.CreateNew.ToContract<Contract.ProposalDecision>();

        // Assert
        mapped.Should().Be(Contract.ProposalDecision.CreateNew);
    }

    // keep-comment: the wire carried these as strings before they were enums; the shipped app still reads strings
    [Fact]
    public void AContractEnumGoesOnTheWireAsItsName()
    {
        // Act
        var json = JsonSerializer.Serialize(new { Status = Contract.ReportStatus.ContentExpired });

        // Assert
        json.Should().Be("""{"Status":"ContentExpired"}""");
    }
}
