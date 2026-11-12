// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;

namespace UnitTests.ArchitectureTests;

// The GlobalUsings rule in docs/conventions/backend.md. keep-comment: where the rule is explained
public class GlobalUsingsTests
{
    private static readonly string[] DomainRoots =
    [
        "Core.Interfaces.Repositories", "Core.Interfaces.Services", "Core.Repositories", "Core.Services", "Core.Factories",
    ];

    private static readonly List<string> DomainNamespaces = typeof(Result).Assembly.GetTypes()
        .Select(type => type.Namespace)
        .OfType<string>()
        .Where(ns => DomainRoots.Any(root => ns.StartsWith(root + ".", StringComparison.Ordinal)))
        .Distinct()
        .Order(StringComparer.Ordinal)
        .ToList();

    [Theory]
    [InlineData("Core/GlobalUsings.cs")]
    [InlineData("Tests/UnitTests/GlobalUsings.cs")]
    [InlineData("Tests/IntegrationTests/GlobalUsings.cs")]
    public void CoreAndTests_ShouldImportEveryDomainNamespace(string file)
    {
        var missing = DomainNamespaces.Except(GlobalUsings(file));

        string.Join(", ", missing).Should().BeEmpty("a new domain's namespaces go in GlobalUsings.cs of Core and both test projects");
    }

    [Fact]
    public void Api_ShouldImportEveryServiceInterfaceNamespace()
    {
        var missing = DomainNamespaces
            .Where(ns => ns.StartsWith("Core.Interfaces.Services.", StringComparison.Ordinal) && !ns.EndsWith(".Models", StringComparison.Ordinal))
            .Except(GlobalUsings("StigviddAPI/GlobalUsings.cs"));

        string.Join(", ", missing).Should().BeEmpty("controllers reach a domain through its service interface, imported once in StigviddAPI");
    }

    private static HashSet<string> GlobalUsings(string relativePath)
    {
        return File.ReadLines(Path.Combine(BackendDirectory(), relativePath))
            .Select(line => line.Trim())
            .Where(line => line.StartsWith("global using ", StringComparison.Ordinal) && line.EndsWith(';'))
            .Select(line => line["global using ".Length..^1].Trim())
            .ToHashSet(StringComparer.Ordinal);
    }

    // keep-comment: the tests run from bin/, so walk up to the folder that holds backend.sln
    private static string BackendDirectory()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "backend.sln")))
            {
                return directory.FullName;
            }
        }

        throw new InvalidOperationException("backend.sln was not found above " + AppContext.BaseDirectory);
    }
}
