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

    [Fact]
    public void EncodeDistance_ThenDecode_GivesTheExactSameDouble()
    {
        var key = new EventDistanceKey(10_000_000.0 / 3.0, 7);

        EventCursor.TryDecodeDistance(EventCursor.EncodeDistance(key), out var decoded).Should().BeTrue();

        decoded.Should().NotBeNull();
        BitConverter.DoubleToInt64Bits(decoded.SquaredMetres).Should().Be(BitConverter.DoubleToInt64Bits(key.SquaredMetres));
        decoded.Id.Should().Be(7);
    }

    [Fact]
    public void A_CursorOfOneSort_IsRefusedByTheOther()
    {
        var byStart = EventCursor.Encode(new EventPageKey(new DateTime(2026, 11, 2, 18, 30, 0, DateTimeKind.Utc), 42));
        var byDistance = EventCursor.EncodeDistance(new EventDistanceKey(1234.5, 42));

        EventCursor.TryDecodeDistance(byStart, out _).Should().BeFalse();
        EventCursor.TryDecode(byDistance, out EventPageKey? _).Should().BeFalse();
    }

    [Theory]
    [InlineData("d:-1:5")]
    [InlineData("d:NaN:5")]
    [InlineData("d:Infinity:5")]
    [InlineData("d:12.5")]
    [InlineData("x:12.5:5")]
    public void TryDecodeDistance_Garbage_IsRefused(string raw)
    {
        var cursor = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(raw));

        EventCursor.TryDecodeDistance(cursor, out _).Should().BeFalse();
    }
}
