// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Runtime.CompilerServices;
using AwesomeAssertions;
using FluentValidation;

namespace UnitTests.ArchitectureTests;

// The placement rules in docs/conventions/backend.md. keep-comment: where each rule is explained
public class CoreStructureTests
{
    // keep-comment: a new domain is added here on purpose, so it is a decision rather than a typo
    private static readonly HashSet<string> Domains =
    [
        "Account", "CityAreas", "DataTransfer", "DomainEvents", "Events", "Friends", "Hikes",
        "HikeShares", "Mail", "Media", "Push", "Reporting", "TrailImport", "Trails",
    ];

    private static readonly string[] DomainRoots =
    [
        "Core.Interfaces.Repositories", "Core.Interfaces.Services", "Core.Repositories",
        "Core.Services", "Core.Factories", "Core.Validators",
    ];

    private static readonly List<Type> CoreTypes = typeof(Result).Assembly.GetTypes()
        .Where(type => !type.IsNested && !type.IsDefined(typeof(CompilerGeneratedAttribute), false) && type.Namespace is not null)
        .ToList();

    [Fact]
    public void InterfaceFolders_ShouldHoldOnlyInterfaces()
    {
        var misplaced = CoreTypes
            .Where(type => IsUnder(type, "Core.Interfaces") && !IsModels(type) && !type.IsInterface)
            .Select(Name);

        misplaced.Should().BeEmpty("records, enums and exceptions go in the Models folder beside the interface");
    }

    [Fact]
    public void ModelsFolders_ShouldHoldNoInterfaces()
    {
        var misplaced = CoreTypes.Where(type => IsModels(type) && type.IsInterface).Select(Name);

        misplaced.Should().BeEmpty();
    }

    [Fact]
    public void DomainFolders_ShouldUseTheKnownDomainNames()
    {
        var unknown = CoreTypes
            .Select(type => DomainOf(type))
            .Where(domain => domain is not null && !Domains.Contains(domain))
            .Distinct();

        unknown.Should().BeEmpty("every layer uses the same domain names; a new one is added to Domains");
    }

    [Fact]
    public void Validators_ShouldLiveInADomainFolderUnderValidators()
    {
        var misplaced = CoreTypes
            .Where(type => type is { IsAbstract: false, IsClass: true } && IsValidator(type))
            .Where(type => !IsUnder(type, "Core.Validators") || DomainOf(type) is null)
            .Select(Name);

        misplaced.Should().BeEmpty();
    }

    [Fact]
    public void Repositories_ShouldLiveInADomainFolderUnderRepositories()
    {
        var misplaced = CoreTypes
            .Where(type => type is { IsClass: true, IsAbstract: false } && type.Name.EndsWith("Repository", StringComparison.Ordinal))
            .Where(type => !IsUnder(type, "Core.Repositories") || DomainOf(type) is null)
            .Select(Name);

        misplaced.Should().BeEmpty();
    }

    [Fact]
    public void Services_ShouldLiveInADomainFolderUnderServices()
    {
        var misplaced = CoreTypes
            .Where(type => type is { IsClass: true, IsAbstract: false } && type.Name.EndsWith("Service", StringComparison.Ordinal))
            .Where(type => !IsUnder(type, "Core.Services") || DomainOf(type) is null)
            .Select(Name);

        misplaced.Should().BeEmpty();
    }

    [Fact]
    public void ResponseFactories_ShouldLiveInADomainFolderUnderFactories()
    {
        var misplaced = CoreTypes
            .Where(type => type.IsClass && type.Name.EndsWith("ResponseFactory", StringComparison.Ordinal))
            .Where(type => !IsUnder(type, "Core.Factories") || DomainOf(type) is null)
            .Select(Name);

        misplaced.Should().BeEmpty();
    }

    private static bool IsUnder(Type type, string root)
    {
        return type.Namespace == root || type.Namespace?.StartsWith(root + ".", StringComparison.Ordinal) == true;
    }

    private static bool IsModels(Type type)
    {
        return IsUnder(type, "Core.Interfaces") && type.Namespace?.Split('.').Contains("Models") == true;
    }

    private static bool IsValidator(Type type)
    {
        for (var current = type.BaseType; current is not null; current = current.BaseType)
        {
            if (current.IsGenericType && current.GetGenericTypeDefinition() == typeof(AbstractValidator<>))
            {
                return true;
            }
        }

        return false;
    }

    private static string? DomainOf(Type type)
    {
        foreach (var root in DomainRoots)
        {
            if (type.Namespace?.StartsWith(root + ".", StringComparison.Ordinal) == true)
            {
                return type.Namespace[(root.Length + 1)..].Split('.')[0];
            }
        }

        return null;
    }

    private static string Name(Type type)
    {
        return type.FullName ?? type.Name;
    }
}
