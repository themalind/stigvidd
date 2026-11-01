// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Events;

namespace UnitTests.Events;

public class DomainEventRegistryTests
{
    [DomainEventName("dup.name")]
    private sealed record FirstDuplicate(int Id) : IDomainEvent;

    [DomainEventName("dup.name")]
    private sealed record SecondDuplicate(int Id) : IDomainEvent;

    private sealed record Unnamed(int Id) : IDomainEvent;

    [DomainEventName("this.name.is.far.too.long.for.the.event.type.column.because.it.runs.past.one.hundred.characters.in.total")]
    private sealed record TooLong(int Id) : IDomainEvent;

    [Fact]
    public void FromTypes_WithANameLongerThanTheColumn_Throws()
    {
        var build = () => DomainEventRegistry.FromTypes([typeof(TooLong)]);

        build.Should().Throw<InvalidOperationException>().WithMessage("*longer than*");
    }

    [Fact]
    public void FromTypes_WithTwoEventsSharingAName_Throws()
    {
        var build = () => DomainEventRegistry.FromTypes([typeof(FirstDuplicate), typeof(SecondDuplicate)]);

        build.Should().Throw<InvalidOperationException>().WithMessage("*dup.name*");
    }

    [Fact]
    public void FromTypes_WithAnEventMissingItsAttribute_Throws()
    {
        var build = () => DomainEventRegistry.FromTypes([typeof(Unnamed)]);

        build.Should().Throw<InvalidOperationException>().WithMessage("*Unnamed*");
    }

    [Fact]
    public void FromTypes_IgnoresTypesThatAreNotEvents()
    {
        var registry = DomainEventRegistry.FromTypes([typeof(string), typeof(TestPing)]);

        registry.TryGet("test.ping", out var descriptor).Should().BeTrue();
        descriptor?.ClrType.Should().Be(typeof(TestPing));
    }

    [Fact]
    public void Describe_ReturnsTheNameAndTheClrType()
    {
        var registry = DomainEventRegistry.FromTypes([typeof(TestPing)]);

        var descriptor = registry.Describe(typeof(TestPing));

        descriptor.Name.Should().Be("test.ping");
        descriptor.ClrType.Should().Be(typeof(TestPing));
    }

    [Fact]
    public void Describe_ForAnUnregisteredType_Throws()
    {
        var registry = DomainEventRegistry.FromTypes([typeof(TestPing)]);

        var describe = () => registry.Describe(typeof(FirstDuplicate));

        describe.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void TryGet_ForAnUnknownName_ReturnsFalse()
    {
        var registry = DomainEventRegistry.FromTypes([typeof(TestPing)]);

        registry.TryGet("no.such.event", out _).Should().BeFalse();
    }

    [Fact]
    public void Scan_OfTheCoreAssembly_Succeeds()
    {
        var scan = () => DomainEventRegistry.Scan(typeof(DomainEventRegistry).Assembly);

        scan.Should().NotThrow();
    }
}
