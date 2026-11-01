// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Events;

namespace UnitTests.Events;

public class DomainEventSerializerTests
{
    [Fact]
    public void ToRecord_CutsAnOverlongEntityKeyToWhatTheColumnHolds()
    {
        var record = DomainEventSerializer.ToRecord(new TestPing(1), new string('k', 250));

        record.EntityKey.Should().HaveLength(100);
    }

    [Fact]
    public void ToRecord_KeepsAnEntityKeyThatFits()
    {
        var record = DomainEventSerializer.ToRecord(new TestPing(1), "user:7");

        record.EntityKey.Should().Be("user:7");
    }
}
