// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Core.Services.Events;

namespace UnitTests.ServiceTests;

public class EventCursorTests
{
    [Fact]
    public void Encode_ThenDecode_GivesTheSameKey()
    {
        var key = new EventPageKey(new DateTime(2026, 11, 2, 18, 30, 0, DateTimeKind.Utc), 42);

        EventCursor.TryDecode(EventCursor.Encode(key), out var decoded).Should().BeTrue();

        decoded.Should().Be(key);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void TryDecode_NoCursor_IsTheFirstPage(string? cursor)
    {
        EventCursor.TryDecode(cursor, out var decoded).Should().BeTrue();

        decoded.Should().BeNull();
    }

    [Theory]
    [InlineData("not base64!")]
    [InlineData("MTIz")]
    [InlineData("LTE6Mg==")]
    [InlineData("OTk5OTk5OTk5OTk5OTk5OTk5OTo5")]
    [InlineData("MzE1NTM3ODk3NjAwMDAwMDAwMTo5")]
    public void TryDecode_Garbage_IsRefused(string cursor)
    {
        EventCursor.TryDecode(cursor, out _).Should().BeFalse();
    }
}
